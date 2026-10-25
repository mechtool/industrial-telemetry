# -*- coding: utf-8 -*-
"""
Захват и проверка формата JSON-массива от шлюза Waveshare (MQTT+JSON).

Подключается к MQTT-брокеру, подписывается на топик, ловит сообщения N секунд
и для каждого payload проверяет целевую структуру «массив объектов контроллеров»:

    {"controllers":[ {"addr":1,"name":"chamber-1", ...}, {"addr":2,"name":"chamber-2", ...} ]}

или голый массив:

    [ {"addr":1, ...}, {"addr":2, ...} ]

Без внешних зависимостей (чистый MQTT 3.1.1 поверх сокета), как mqtt_listen.py.

Использование:
    python capture_and_verify.py [host] [port] [topic] [seconds]

Пример:
    python capture_and_verify.py 158.160.204.124 1883 "industrial/sensors/akcc55" 70
"""

import json
import socket
import struct
import sys
import time

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HOST = sys.argv[1] if len(sys.argv) > 1 else "158.160.204.124"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 1883
TOPIC = sys.argv[3] if len(sys.argv) > 3 else "industrial/sensors/akcc55"
SECONDS = float(sys.argv[4]) if len(sys.argv) > 4 else 70.0

# Нормализованные ключи свойств одного контроллера (совпадают с register map шлюза).
EXPECTED_KEYS = [
    "pe", "s2", "s3", "s4", "s5",
    "setpoint", "diff", "main_switch",
    "air_temp", "evap_temp", "food_temp",
    "s2_temp", "s3_temp", "s4_temp", "s5_temp",
    "reg_state", "eev_opening", "pwm_od",
    "alarm_sum", "alarm_high_temp", "alarm_low_temp",
]

# Ключи идентификации контроллера в каждом элементе массива.
IDENTITY_KEYS = ["addr", "name", "id", "device"]


def mstr(s: str) -> bytes:
    b = s.encode()
    return struct.pack(">H", len(b)) + b


def varint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n % 128
        n //= 128
        if n > 0:
            b |= 0x80
        out.append(b)
        if n == 0:
            return bytes(out)


def envelope(header: int, body: bytes) -> bytes:
    return bytes([header]) + varint(len(body)) + body


def read_packet(sock):
    head = sock.recv(1)
    if not head:
        return None
    mult, length = 1, 0
    while True:
        b = sock.recv(1)
        if not b:
            return None
        length += (b[0] & 0x7F) * mult
        mult *= 128
        if not (b[0] & 0x80):
            break
    body = b""
    while len(body) < length:
        part = sock.recv(length - len(body))
        if not part:
            return None
        body += part
    return head[0], body


def extract_array(parsed):
    """Возвращает (список элементов, имя ключа-обёртки или None)."""
    if isinstance(parsed, list):
        return parsed, None
    if isinstance(parsed, dict):
        arrays = {k: v for k, v in parsed.items() if isinstance(v, list)}
        if len(arrays) == 1:
            key, arr = next(iter(arrays.items()))
            return arr, key
        if arrays:
            key, arr = next(iter(arrays.items()))
            return arr, key
    return None, None


def verify_payload(payload: bytes):
    """Проверяет один payload. Возвращает (ok, строку-отчёт)."""
    try:
        parsed = json.loads(payload.decode("utf-8", "replace"))
    except Exception as e:
        return False, f"  НЕ JSON: {e}"

    arr, wrapper = extract_array(parsed)
    if arr is None:
        shape = "array" if isinstance(parsed, list) else type(parsed).__name__
        return False, f"  массив не найден (верхний уровень: {shape})"

    lines = []
    if wrapper:
        lines.append(f"  обёртка: ключ '{wrapper}' -> массив из {len(arr)} элементов")
    else:
        lines.append(f"  голый массив из {len(arr)} элементов")

    problems = []
    key_sets = []
    for i, el in enumerate(arr):
        if not isinstance(el, dict):
            problems.append(f"элемент[{i}] не объект, а {type(el).__name__}")
            continue
        key_sets.append(set(el.keys()))
        ident = {k: el.get(k) for k in IDENTITY_KEYS if k in el}
        ident_s = ", ".join(f"{k}={v}" for k, v in ident.items()) or "НЕТ addr/name/id"
        missing = [k for k in EXPECTED_KEYS if k not in el]
        lines.append(f"  [{i}] {ident_s}")
        if missing:
            problems.append(f"элемент[{i}]: нет ключей {missing}")

    if key_sets:
        first = key_sets[0]
        for i, ks in enumerate(key_sets[1:], start=1):
            only_first = sorted(first - ks)
            only_this = sorted(ks - first)
            if only_first or only_this:
                problems.append(
                    f"элемент[{i}]: ключи отличаются от элемента[0] "
                    f"(лишние {only_this}, нет {only_first})"
                )

    for k in IDENTITY_KEYS:
        if all(isinstance(el, dict) and k in el for el in arr):
            lines.append(f"  идентификация: ключ '{k}' есть во всех элементах")
            break
    else:
        problems.append("ни один идентификационный ключ (addr/name/id/device) не во всех элементах")

    ok = not problems
    status = "PASS" if ok else "FAIL"
    header = f"  {status}"
    for p in problems:
        lines.append(f"    ! {p}")
    return ok, "\n".join([header] + lines)


def main() -> int:
    print(f"Подключаюсь к {HOST}:{PORT}, подписка '{TOPIC}', слушаю {SECONDS:.0f} с\n")
    try:
        s = socket.create_connection((HOST, PORT), timeout=10)
    except Exception as e:
        print(f"НЕ УДАЛОСЬ СОЕДИНИТЬСЯ: {e}")
        return 1

    received = 0
    passed = 0
    with s:
        s.settimeout(10)
        cid = f"verify-{int(time.time()) % 100000}"
        vh = mstr("MQTT") + bytes([4, 0x02]) + struct.pack(">H", 60) + mstr(cid)
        s.sendall(envelope(0x10, vh))
        pkt = read_packet(s)
        if not pkt or pkt[0] != 0x20:
            print("Нет CONNACK")
            return 2
        code = pkt[1][1] if len(pkt[1]) >= 2 else -1
        if code != 0:
            print(f"CONNACK: отказ, код {code}")
            return 3

        s.sendall(envelope(0x82, struct.pack(">H", 1) + mstr(TOPIC) + bytes([1])))
        pkt = read_packet(s)
        if pkt and pkt[0] == 0x90:
            print("SUBACK получен — подписка активна\n")

        s.settimeout(1.0)
        deadline = time.monotonic() + SECONDS
        while time.monotonic() < deadline:
            try:
                pkt = read_packet(s)
            except socket.timeout:
                continue
            except Exception:
                break
            if pkt is None:
                print("соединение закрыто")
                break
            head, body = pkt
            if (head >> 4) != 3:
                continue
            qos = (head >> 1) & 0x03
            tlen = struct.unpack(">H", body[:2])[0]
            topic = body[2:2 + tlen].decode("utf-8", "replace")
            off = 2 + tlen + (2 if qos else 0)
            payload = body[off:]
            received += 1
            print(f"--- сообщение {received}: {topic} ({len(payload)} байт) ---")
            ok, report = verify_payload(payload)
            print(report)
            if ok:
                passed += 1
            print()

        print(f"Итог за {SECONDS:.0f} с: сообщений {received}, PASS {passed}, FAIL {received - passed}")
        s.sendall(envelope(0xE0, b""))
    return 0 if (received and passed == received) else 4


if __name__ == "__main__":
    raise SystemExit(main())
