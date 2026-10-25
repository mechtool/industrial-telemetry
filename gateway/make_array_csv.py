# -*- coding: utf-8 -*-
"""
Генератор CSV-дизайна Vircom для режима «массив объектов контроллеров».

Целевой публикуемый JSON:
    {"controllers":[ {addr,name,pe,s2,...}, {addr,name,pe,s2,...} ]}

ВАЖНО про загрузку в шлюз: дизайн грузится в Vircom через
«JSON Configuration -> 导入配置 (Import)» файлом CSV. На самом шлюзе этот
дизайн хранится бинарным файлом `json` (V0007), который Vircom собирает сам —
руками писать «JSON для загрузки» нельзя.

ВНИМАНИЕ: кодировка вложенных/массивных узлов в CSV выведена из мануала §3.7
и образца экспорта плоских узлов. Точная схема Vircom у нас не зафиксирована,
поэтому перед полным импортом проверьте на минимальном файле
(akcc55-array-min.csv): он содержит обёртку + 2 элемента массива + всего
по 2 поля (addr + setpoint). Если импорт минимального файла даст правильную
структуру в предпросмотре — загружайте полный akcc55-array.csv.
"""

import csv
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Заголовок — дословно из экспорта Vircom (23 колонки; у строк данных 24 поля,
# последнее "255" — терминатор без имени в заголовке).
HEADER = (
    "NO.,JSON KeyWord,Data Source,String,Modbus Slave Addr.,Modbus Function,"
    "Modbus RegAddr,645 ID,645 Type, Data Len,4 Bytes Order,Data Format,"
    "Position of Bool,Decimal Position,Unit,With Qutation,Query Period,"
    "645 version, Func sel, JSON array, substract, divide, FE number"
)

OUT_DIR = Path(__file__).resolve().parent

# Точки телеметрии одного контроллера: (ключ, адрес регистра, десятичных знаков).
POINTS = [
    ("pe", 20001, 0),
    ("s2", 20002, 0),
    ("s3", 20003, 0),
    ("s4", 20004, 0),
    ("s5", 20005, 0),
    ("setpoint", 99, 1),
    ("diff", 100, 1),
    ("main_switch", 116, 0),
    ("air_temp", 2531, 1),
    ("evap_temp", 2543, 1),
    ("food_temp", 2701, 1),
    ("s2_temp", 2536, 1),
    ("s3_temp", 2529, 1),
    ("s4_temp", 2530, 1),
    ("s5_temp", 1010, 1),
    ("reg_state", 2006, 0),
    ("eev_opening", 2527, 0),
    ("pwm_od", 2632, 0),
    ("alarm_sum", 2540, 0),
    ("alarm_high_temp", 20006, 0),
    ("alarm_low_temp", 20007, 0),
]

# Контроллеры: (Modbus slave addr, имя, адрес как строка в JSON).
CONTROLLERS = [
    (1, "chamber-1", "1"),
    (2, "chamber-2", "2"),
]


def modbus_row(no: str, key: str, slave: int, regaddr: str, dec: int) -> list:
    return [
        no, key, "Modbus RTU", "", str(slave), "3", str(regaddr),
        "000000000001", "00009410", "2", "0", "Signed int", "0", str(dec), "",
        "0", "100", "97", "0", "0", "0", "1.000000", "0", "255",
    ]


def fixed_row(no: str, key: str, value: str) -> list:
    return [
        no, key, "Fixed String", value, "1", "3", "0",
        "000000000001", "00009410", "2", "0", "Signed int", "0", "0", "",
        "0", "100", "97", "0", "0", "0", "1.000000", "0", "255",
    ]


def nested_row(no: str, key: str, is_array: bool) -> list:
    """Обёртка (key) или элемент массива (key='', is_array=True).

    ВАЖНО: источник данных для вложенности называется в Vircom
    «Embeded JSON» (с опечаткой «Embeded») — точная строка из VirCom_en.exe.
    "Nested JSON" Vircom НЕ принимает (ошибка «add embeded node under
    non-embeded json node»)."""
    return [
        no, key, "Embeded JSON", "", "1", "3", "0",
        "000000000001", "00009410", "2", "0", "Signed int", "0", "0", "",
        "0", "100", "97", "0", "1" if is_array else "0", "0", "1.000000", "0", "255",
    ]


def build(controllers, points) -> list:
    rows = [nested_row("1.", "controllers", False)]
    for ci, (slave, name, addr) in enumerate(controllers, start=1):
        rows.append(nested_row(f"1.{ci}", "", True))
        fi = 1
        rows.append(fixed_row(f"1.{ci}.{fi}", "addr", addr)); fi += 1
        rows.append(fixed_row(f"1.{ci}.{fi}", "name", name)); fi += 1
        for key, reg, dec in points:
            rows.append(modbus_row(f"1.{ci}.{fi}", key, slave, reg, dec)); fi += 1
    return rows


def write_csv(name: str, rows: list) -> Path:
    out = OUT_DIR / name
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(HEADER + "\r\n")
        csv.writer(f, lineterminator="\r\n").writerows(rows)
    print(f"{name}: {len(rows)} узлов, {out.stat().st_size:,} байт")
    return out


def main() -> None:
    full = build(CONTROLLERS, POINTS)
    write_csv("akcc55-array.csv", full)

    # Минимальный вариант для проверки импорта: addr + name + pe на контроллер.
    mini = build(CONTROLLERS, POINTS[:1])  # только setpoint
    write_csv("akcc55-array-min.csv", mini)

    print()
    print("Структура полного файла (первые узлы):")
    for row in full[:5]:
        print(f"  {row[0]:<7} key={row[1]!r:<14} src={row[2]:<12} arr={row[19]} string={row[3]!r}")
    print("  ...")
    print("Контроль: у каждого контроллера", 2 + len(POINTS), "полей.")


if __name__ == "__main__":
    main()
