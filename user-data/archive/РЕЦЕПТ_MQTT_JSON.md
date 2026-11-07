# РЕЦЕПТ: режим MQTT+JSON на шлюзе

*Проверено 24.10.2026 — шлюз публикует данные без сборщика и без компьютера.*

---

## Четыре обязательных условия

Если хотя бы одно не выполнено — **клиент подключается к брокеру, но публикаций нет**.

| # | Где | Параметр | Значение |
|---|---|---|---|
| 1 | Параметры устройства | **Work Mode** | **TCP Client** |
| 2 | Параметры устройства | **Transfer Protocol** | **None** ← на этом потеряли часы |
| 3 | JSON Configuration | **Upper protocol** | **NONE/MQTT** |
| 4 | JSON Configuration | **Period of send** | **30000** |

Плюс Destination IP/Port в параметрах устройства: `158.160.204.124` : `1883`.

---

## Почему именно Transfer Protocol = None

В режиме `Modbus TCP to RTU` шлюз работает **преобразователем**: принимает
Modbus TCP на порту 4196 и транслирует в RTU. Движок JSON в этом режиме
не запускается — устройство занято ролью моста.

Для MQTT+JSON нужно, чтобы шлюз **сам был Modbus-мастером** на линии RS485.
Тогда `Transfer Protocol = None` отключает трансляцию, и управление портом
переходит к движку JSON.

**Симптом ошибки:** `akcc55-gateway` подключается к брокеру, PINGREQ идут,
`Received PUBLISH` — ноль. Настройки при этом выглядят правильными.

---

## Пошагово

1. Vircom → **Device Management → Search** → двойной щелчок по устройству.
2. **Restart Dev** → дождаться перезагрузки → снова **Search**.
3. **Firmware/Config** → режим **web directory download** →
   папка `C:\Users\Saturn\Documents\gateway-mqtt-design`.
4. **JSON Configuration**:
   - «删除全部» (Delete all)
   - «导入配置» (Import) → `akcc55-mqtt.csv` (21 регистр)
   - проверить: ровно 21 строка, **пустых ключей нет**
   - **Upper protocol = NONE/MQTT**
   - **Period of send = 30000**
5. **MQTT Configuration**: `158.160.204.124`, `1883`,
   Client ID `akcc55-gateway`, Publish topic `industrial/sensors/akcc55`, QoS 1.
6. В параметрах устройства: **Work Mode = TCP Client**, **Transfer Protocol = None**,
   Destination `158.160.204.124:1883`, serial `9600 8E1`.
7. **Save JSON settings** → **Save MQTT settings** → **Download**.
8. Дождаться перезагрузки (~1 минута).

---

## Как убедиться, что заработало

```powershell
# 1. Порт 4196 должен ЗАКРЫТЬСЯ
python -c "import socket; s=socket.socket(); s.settimeout(4);
try: s.connect(('192.168.31.200',4196)); print('ОТКРЫТ — режим не переключился')
except Exception as e: print('закрыт — режим MQTT активен')"

# 2. В брокере должны появиться публикации
ssh yc-vm "docker exec it-mosquitto grep 'Received PUBLISH from akcc55-gateway' /mosquitto/log/mosquitto.log | tail -5"

# 3. В базе должны расти строки
ssh yc-vm "docker exec it-kratos-db psql -U kratos -d telemetry -c 'select count(*) from telemetry'"
```

---

## Побочные эффекты

| Что | Почему |
|---|---|
| Веб-интерфейс шлюза перестаёт открываться | MQTT-конфигурация заменяет веб-страницы настройки |
| Порт 4196 закрывается | Режим Modbus TCP↔RTU отключён |
| Настройки видны только в Vircom | Веб-страницы нет |

---

## Возврат к схеме со сборщиком

1. **Restart Dev** → Search → **Firmware/Config**.
2. **Program File Download** → `1.523(2007).BIN` → Download.
3. **web directory download** → `2043_waveshare_web_zx` → Download.
4. `python gateway_configure.py --set wkm=0 --set lcp=4196 --set ptc=1`
5. `python gateway_restore.py --file backup_collector_20261024\gateway_config.txt`

---

## Что ещё пригодится

| Файл | Назначение |
|---|---|
| `mqtt.txt` в папке дизайна | настройки MQTT открытым текстом: `CLIENT_ID`, `PUBLISH_TOPIC`, `PUBLISH_QOS` |
| `json` в папке дизайна | бинарный дизайн; по строковым смещениям видно, какие ключи загружены |
| `akcc55-mqtt-fixed.csv` | тест движка без RS485 (Fixed String `hello: world`) |
| `akcc55-mqtt-min.csv` | минимальный дизайн, 1 регистр |
| `make_mqtt_csv.py` / `make_test_csv.py` / `make_fixed_csv.py` | генераторы CSV |
| `mqtt_watch.py` | длительное наблюдение за брокером с записью в лог |
