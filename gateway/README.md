# Шлюз Waveshare RS485 TO POE ETH (B) — MQTT+JSON: инструкция и история экспериментов

> Полный контекст работы со шлюзом, контроллерами Danfoss AK-CC55 и форматами
> публикуемого JSON. Документ заменяет разрозненные заметки в корне репозитория
> (`ИСТОРИЯ_СЕССИИ_24-25.10.2026.md`, `НАСТРОЙКИ_СТЕНДА.md`, `РЕЦЕПТ_MQTT_JSON.md`).

---

## 1. Стенд

```
AK-CC55 Compact (2 шт, RS485 9600 8E1, адреса 1 и 2)
        │  RS485
        ▼
Waveshare RS485 TO POE ETH (B)  192.168.31.200   (прошивка «MQTT And JSON»)
        │  MQTT, сам является Modbus-мастером
        ▼
Mosquitto  158.160.204.124:1883  (контейнер it-mosquitto, allow_anonymous true)
        │  топик industrial/sensors/akcc55
        ▼
it-keeper (server/src/keeper.ts)  →  PostgreSQL `telemetry`
```

Ключевые адреса:

- Шлюз: `192.168.31.200`, MAC `04-EE-E8-1D-13-94`, штатная прошивка V1.523.
- Контроллеры: Danfoss **AK-CC55 Compact** (код заказа `084B4081`), Modbus-адреса `o03 = 1` и `2`.
- Сервер: ВМ Yandex Cloud `158.160.204.124`, домен `industrial-telemetry.ru`, SSH-алиас `yc-vm`.
- БД: PostgreSQL `it-kratos-db`, база `telemetry`, таблица `telemetry(id, ts, device, topic, payload JSONB)`.

---

## 2. Настройки шлюза (режим MQTT+JSON)

В этом режиме шлюз **сам** опрашивает контроллеры по Modbus RTU и публикует
результат в MQTT. Компьютер/сборщик в цепочке не участвуют.

### Устройство (Vircom → параметры устройства)

| Параметр | Значение |
|---|---|
| Work Mode | **TCP Client** |
| **Transfer Protocol** | **None** ← критично, см. §5 |
| Destination IP : Port | `158.160.204.124` : `1883` |
| Serial | `9600`, 8 бит, **Even**, 1 стоп-бит |

### JSON-конфигурация

| Параметр | Значение |
|---|---|
| Upper protocol | **NONE/MQTT** |
| Period of send | **30000** (мс) |
| Query period (на узел) | 100 (мс) |

### MQTT (файл `mqtt.txt`)

```
CLIENT_ID=akcc55-gateway
KEEPALIVE=60
CLEAN_SESSION=1
PUBLISH_TOPIC=industrial/sensors/akcc55
PUBLISH_QOS=1
PUBLISH_RETAIN=0
```

### Modbus

- Функция чтения: **03**.
- Адрес регистра = **PNU − 1** (zero-based). Уставка `r00` = адрес **99**.
- Контроллер 1 → slave `1`; контроллер 2 → slave `2`.

---

## 3. Два формата JSON

### 3.1 Формат «объект» (плоский) — старый

Один плоский объект, второй контроллер — с префиксом `c2_`:

```json
{
  "pe": 1, "s2": 1, "setpoint": 3.0, "air_temp": 22.9,
  "c2_pe": 1, "c2_s2": 1, "c2_setpoint": 12.0, "c2_air_temp": 21.9
}
```

Недостатки (почему отказались):

- ключи контроллеров различаются (`pe` vs `c2_pe`), единой схемы нет;
- нормализатор на сервере видел только «чистые» ключи первого контроллера,
  второй лежал в `raw.c2_*` и в `values` не попадал;
- нет явной привязки к адресу/имени контроллера.

Спека и карта регистров этого формата — в `akcc55-poll.json`.

### 3.2 Формат «массив объектов» — текущий

Массив `controllers`, по одному объекту на контроллер, одинаковые ключи,
плюс `addr` и `name`:

```json
{
  "controllers": [
    { "addr": "1", "name": "chamber-1", "pe": 1, "s2": 1, "s3": 0, "s4": 1, "s5": 0,
      "setpoint": 3.0, "diff": 3.1, "main_switch": 1,
      "air_temp": 22.9, "evap_temp": -267.9, "food_temp": 22.9,
      "s2_temp": 180.0, "s3_temp": 22.9, "s4_temp": 180.0, "s5_temp": 120.0,
      "reg_state": 16, "eev_opening": 0, "pwm_od": 0,
      "alarm_sum": 1, "alarm_high_temp": 0, "alarm_low_temp": 0 },
    { "addr": "2", "name": "chamber-2", "...": "..." }
  ]
}
```

- `addr`, `name` — Fixed String (жёстко заданы в дизайне).
- Остальные 21 ключ — Modbus RTU, функция 03.
- Схема и пример — `akcc55-array.spec.json`.
- Загружаемый дизайн — `akcc55-array.csv` (полный) и `akcc55-array-min.csv` (тестовый).

Проверено на живом шлюзе: публикация 656 байт каждые ~31 с, 2 контроллера,
все 21 ключ на месте.

---

## 4. Формат CSV-дизайна Vircom

Дизайн (структура JSON) загружается в Vircom **только CSV-файлом**
(«JSON Configuration» → «导入配置»). На самом шлюзе дизайн хранится бинарным
файлом `json` (заголовок `V0007`), который Vircom собирает сам — руками
«JSON для загрузки» не пишется.

### Колонки

Заголовок — 23 колонки, у строк данных — 24 поля (последнее `255` — терминатор
без имени в заголовке):

```
NO. | JSON KeyWord | Data Source | String | Modbus Slave Addr. | Modbus Function |
Modbus RegAddr | 645 ID | 645 Type | Data Len | 4 Bytes Order | Data Format |
Position of Bool | Decimal Position | Unit | With Qutation | Query Period |
645 version | Func sel | JSON array | substract | divide | FE number | [255]
```

### Значения `Data Source` (точные токены)

| Токен | Назначение |
|---|---|
| `Modbus RTU` | значение из регистра Modbus |
| `Fixed String` | фиксированная строка (в колонке `String`) |
| `Device ID` | MAC/ID шлюза |
| `Current Time` | время по NTP |
| **`Embeded JSON`** | вложенный контейнер (объект/элемент массива) |

> ⚠️ Токен — **`Embeded JSON`** (с опечаткой Waveshare «Embeded»). `Nested JSON`
> Vircom **не принимает** и выдаёт «add embeded node under non-embeded json node».

### Тип узла — колонка `JSON array`

- `0` = **Object data** (объект, нужен `JSON KeyWord`).
- `1` = **Array data** (элемент массива, `JSON KeyWord` пустой).

### Нумерация `NO.`

`1.` — узел верхнего уровня; вложенные — точками: `1.1`, `1.1.1`, `1.2`, …

### Как кодируется массив объектов

```
1.      controllers   Embeded JSON   JSON array=0   ← обёртка (объект)
1.1                   Embeded JSON   JSON array=1   ← элемент массива (без ключа)
1.1.1   addr          Fixed String   "1"
1.1.2   name          Fixed String   "chamber-1"
1.1.3   pe            Modbus RTU     slave=1, reg=20001
...
1.2                   Embeded JSON   JSON array=1   ← второй элемент
1.2.1   addr          Fixed String   "2"
...
```

Генератор: `make_array_csv.py` (запуск `python make_array_csv.py` пересоздаёт
`akcc55-array.csv` и `akcc55-array-min.csv`).

---

## 5. Грабли, на которые уже наступали

1. **Чётность RS485 — только Even.** С `None` контроллер молчит полностью.
2. **Адрес регистра = PNU − 1.** Уставка `r00` читается по адресу 99, а не 100.
3. **`r02` ограничивает `r00`.** Запись уставки выше `r02` отклоняется
   `ILLEGAL DATA VALUE` — сначала поднять `r02`, потом `r00`.
4. **MQTT+JSON: Transfer Protocol = None.** В режиме `Modbus TCP to RTU` шлюз
   работает мостом на порту 4196 и движок JSON не запускает: клиент к брокеру
   цепляется, keepalive идёт, публикаций ноль.
5. **`Embeded JSON`, а не `Nested JSON`.** Неверный токен источника данных даёт
   ошибку импорта CSV «add embeded node under non-embeded json node in excell».
6. **После правки настроек шлюза проверять порт 4196 / публикации** — «Success!
   restart» не гарантирует, что настройки применились.
7. **Побочный эффект прошивки MQTT+JSON:** веб-интерфейс шлюза перестаёт
   открываться, порт 4196 закрывается — настройки видны только через Vircom.
   Возврат — обратной прошивкой V1.523 + веб-каталогом `2043_waveshare_web_zx`.

---

## 6. Как загрузить дизайн в шлюз

1. Vircom → **Device Management → Search** → двойной щелчок по устройству.
2. **Restart Dev** → дождаться → снова **Search**.
3. **Firmware/Config** → режим **web directory download** → выбрать каталог.
4. **JSON Configuration** → «删除全部» (Delete all) → «导入配置» (Import) →
   нужный CSV (`akcc55-array.csv`).
5. Проверить **предпросмотр** («保存 JSON 设计»): структура `{"controllers":[...]}`,
   число строк соответствует дизайну, пустых ключей нет.
6. Выставить **Upper protocol = NONE/MQTT**, **Period of send = 30000**.
7. **MQTT Configuration**: server `158.160.204.124`, port `1883`,
   Client ID `akcc55-gateway`, publish topic `industrial/sensors/akcc55`, QoS 1.
8. Параметры устройства: **Work Mode = TCP Client**, **Transfer Protocol = None**,
   Destination `158.160.204.124:1883`, serial `9600 8E1`.
9. **Save JSON settings** → **Save MQTT settings** → **Download**.
10. Дождаться перезагрузки (~1 мин). Признак успеха: порт 4196 закрыт, в логе
    Mosquitto появляется `Received PUBLISH from akcc55-gateway`.

Совет: для проверки импорта вложенной структуры сначала грузите минимальный
`akcc55-array-min.csv` (обёртка + 2 элемента × `addr`,`name`,`pe`), затем полный.

---

## 7. Как проверить, что публикуется

Локальный валидатор (без внешних зависимостей) — ловит сообщения N секунд и
проверяет структуру массива:

```powershell
python gateway/capture_and_verify.py 158.160.204.124 1883 "industrial/sensors/akcc55" 75
```

Просто посмотреть payload:

```powershell
python mqtt_listen.py 158.160.204.124 1883 "industrial/sensors/akcc55" 40
```

Серверная сторона:

```powershell
ssh yc-vm "docker exec it-mosquitto mosquitto_sub -h 127.0.0.1 -t 'industrial/sensors/akcc55' -C 1 -v"
ssh yc-vm "docker exec it-mosquitto grep -a 'Received PUBLISH from akcc55-gateway' /mosquitto/log/mosquitto.log | tail -5"
```

---

## 8. Текущее состояние и следующие шаги

- ✅ Массив публикуется корректно (2 контроллера, 21 ключ, ~31 с).
- ⚠️ **Хранитель массив пока не пишет**: `server/src/services/telemetry/normalize.ts`
  делает `Array.isArray(parsed) → null` и ждёт плоские ключи. Нужно обновить
  нормализатор и репозиторий под `{"controllers":[...]}`: разложить массив на
  строки по контроллерам, `device = addr`/`name`, применять прежнюю логику
  достоверности (флаг ошибки датчика → `null`, температура вне −100…150 °C → `null`).
- Сырые «сентинелы» отсутствующих датчиков: `evap_temp = -267.9`,
  `s2_temp/s4_temp = 180.0`, подозрительный `s5_temp = 120.0` — после нормализации
  должны превращаться в `null`.
- Дальше по приоритету: API телеметрии, безопасность MQTT, ретеншен, мониторинг.

---

## 9. Файлы в этой папке

| Файл | Назначение |
|---|---|
| `README.md` | эта инструкция |
| `akcc55-array.csv` | полный дизайн «массив объектов» (2 контроллера, 21 ключ) |
| `akcc55-array-min.csv` | минимальный тестовый дизайн (2 контроллера × `addr`,`name`,`pe`) |
| `akcc55-array.spec.json` | JSON-схема целевого выходного формата + пример |
| `akcc55-poll.json` | старый «объектный» формат + карта регистров (PNU/адрес/вид/датчик) |
| `make_array_csv.py` | генератор CSV-дизайна |
| `capture_and_verify.py` | захват и проверка живого формата |
| `backup/` | снимки конфигурации шлюза (справочно) |
