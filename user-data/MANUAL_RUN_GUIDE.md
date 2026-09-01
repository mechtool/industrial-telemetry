# Industrial Telemetry — Руководство по запуску и эксплуатации

**Версия:** 4.1
**Дата:** 2026-08-30
**Стек:** Angular 22 (PWA, NG-ZORRO) · Express (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14 · PostgreSQL 16 · Nginx

---

> ⚠️ **v4.1:** исправлены баги Keto (тег образа → `oryd/keto:v0.14.0`, флаг `-c` у `keto-migrate`, автосоздание БД `keto` через `keto/init-keto.sql`) и обработка wildcard-топиков MQTT; в разделе 5.6 добавлена проверка данных MQTT.
>
> Правило v4.0 — каталог запуска указан у каждой команды — сохранено.

---

## Оглавление

1. [Карта каталогов: что откуда запускать](#1-карта-каталогов-что-откуда-запускать)
2. [Архитектура](#2-архитектура)
3. [Компоненты](#3-компоненты)
4. [Предварительные требования](#4-предварительные-требования)
5. [Локальная разработка](#5-локальная-разработка)
6. [Управление секретами](#6-управление-секретами)
7. [RBAC: роли и права](#7-rbac-роли-и-права)
8. [Продакшен (Yandex Cloud)](#8-продакшен-yandex-cloud)
9. [Обновление / деплой](#9-обновление--деплой)
10. [Проверка работоспособности](#10-проверка-работоспособности)
11. [Устранение неполадок](#11-устранение-неполадок)
12. [Шпаргалка команд](#12-шпаргалка-команд)

---

## 1. Карта каталогов: что откуда запускать

### 1.1 Структура репозитория

```
industrial-telemetry/                  ← КОРЕНЬ ПРОЕКТА
├── docker-compose.yml                  ← dev-инфраструктура (запуск ИЗ КОРНЯ)
├── docker-compose.yc.yml               ← prod-стек (запуск ИЗ КОРНЯ, с .env.yc)
├── .env.yc                             ← prod-секреты (gitignored)
├── .env.yc.example                     ← шаблон prod-секретов
├── package.json                        ← корневые npm-скрипты
├── Dockerfile.server                   ← сборка Express (используется docker-compose.yc.yml)
├── Dockerfile.client                   ← сборка Angular + Nginx (используется docker-compose.yc.yml)
├── mosquitto.conf                      ← конфиг MQTT-брокера (prod)
├── server/                             ← Express-бэкенд (npm-команды ИЗ server/)
│   ├── package.json
│   ├── .env                            ← локальные настройки сервера (gitignored)
│   └── src/                            ← исходники TypeScript
├── client/                             ← Angular-клиент (npm-команды ИЗ client/)
│   ├── package.json
│   └── proxy.conf.json                 ← dev-прокси /api и /.ory → :3000
├── kratos/                             ← конфиги Kratos (монтируются в Docker, сами команды НЕ запускаются)
├── keto/                               ← конфиги Keto (монтируются в Docker)
├── nginx/                              ← prod-конфиг Nginx
├── scripts/                            ← вспомогательные скрипты (deploy-yc.sh и др.)
└── user-data/                          ← документация (этот файл и др.)
```

### 1.2 Ключевое правило

Есть **ровно три каталога**, из которых что-то запускается:

| Каталог | Что в нём запускают |
|---|---|
| **Корень проекта** (`industrial-telemetry/`) | Все команды `docker compose ...` (и dev, и prod), корневые npm-скрипты (`npm run install:all`, `npm run dev:server`, ...) |
| **`server/`** | `npm ci`, `npm run dev`, `npm run build` для Express-сервера |
| **`client/`** | `npm ci --legacy-peer-deps`, `npm run start`, `npm run build` для Angular |

Каталоги `kratos/`, `keto/`, `nginx/`, `scripts/`, `user-data/` — это **только файлы** (конфиги, скрипты, документация). Из них **ничего не запускается вручную** в ежедневной работе — их содержимое либо монтируется в контейнеры, либо вызывается из других каталогов.

> 💡 **Почему `docker compose` только из корня.** Файлы `docker-compose.yml` и `docker-compose.yc.yml` лежат в корне, а все относительные пути внутри них (`./kratos`, `./keto`, `./mosquitto.conf`, `build.context: ./server`, `--env-file .env.yc`) разрешаются **относительно расположения compose-файла**, то есть относительно корня. Если запустить `docker compose` из другого каталога, Docker не найдёт конфиги и контексты сборки. Поэтому правило простое: **сначала `cd` в корень проекта, потом `docker compose ...`**.

### 1.3 Обозначения в командах

Во всех примерах ниже над каждой командой стоит строка с указанием каталога запуска:

```bash
# Выполнять из: корня проекта
docker compose up -d
```

Обозначения:

- **«корень проекта»** — каталог, где лежат `docker-compose.yml`, `docker-compose.yc.yml` и `package.json`. Локально это `C:\Users\Saturn\WebstormProjects\industrial-telemetry`, на ВМ — `~/industrial-telemetry`.
- **«server/»** — каталог `server` внутри корня.
- **«client/»** — каталог `client` внутри корня.

> 🪟 **Windows / PowerShell.** На машине разработчика (Windows) команды `docker compose`, `npm`, `node`, `git` выглядят одинаково. Единственная разница — `curl`: в PowerShell `curl` является алиасом `Invoke-WebRequest` и работает иначе. Для проверок используйте `curl.exe` (например, `curl.exe http://localhost:3000/api/health`) либо `Invoke-RestMethod http://localhost:3000/api/health`. На ВМ (Ubuntu, bash) используйте обычный `curl`.

---

## 2. Архитектура

```
                         Браузер
              http://localhost:4200  (dev, hot-reload)
              http://localhost:3000  (dev, Express раздаёт статику)
              https://industrial-telemetry.ru  (prod)

        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
   Nginx :80/443            Express API :3000          Angular CLI :4200
   (только prod)            (Keto-клиент + MQTT-мост)   (dev-сервер + proxy)
        │                         │
        ├─► /.ory ──► Kratos :4433│
        │                         ├─► Keto :4466/4467
        │                         └─► Mosquitto :1883
        │                               │
        └──► PostgreSQL :5432 ◄────────┘   (базы kratos, keto)
```

- **Dev**: Nginx не участвует; `/api` и `/.ory` проксируются Angular CLI → Express → Kratos.
- **Prod**: Nginx — единая точка входа (80/443), статика Angular + reverse-proxy на `/api` и `/.ory`.

---

## 3. Компоненты

| Сервис | Назначение | Порты | Образ / технология |
|---|---|---|---|
| **PostgreSQL 16** | БД (Kratos + Keto) | 5432 | `postgres:16-alpine` |
| **Kratos Migrate** | Миграция схемы (одноразовая) | — | `oryd/kratos:v1.3.1` |
| **Ory Kratos** | Identity Provider (регистрация, логин, recovery) | 4433 (public), 4434 (admin) | `oryd/kratos:v1.3.1` |
| **Keto Migrate** | Миграция схемы (одноразовая) | — | `oryd/keto:v0.14.0` |
| **Ory Keto** | Permission Server (RBAC) | 4466 (read), 4467 (write) | `oryd/keto:v0.14.0` |
| **Mosquitto** | MQTT-брокер (телеметрия) | 1883 | `eclipse-mosquitto:2` |
| **Express Server** | API: health, прокси Kratos, Keto-клиент, MQTT-мост | 3000 | Node.js 22 + TypeScript |
| **Nginx + Angular** | Reverse-proxy + раздача PWA | 80, 443 | `nginx:1.27-alpine` + Angular 22 |

### Маршруты клиента (Angular)

| Путь | Компонент |
|---|---|
| `/`, `/login` | Вход (`kratos-auth`) |
| `/registration` | Регистрация (`kratos-auth`, режим registration) |
| `/recovery` | Восстановление пароля |
| `/dashboard` | Панель управления |
| `/profile` | Профиль пользователя |
| `/mqtt` | MQTT-телеметрия |

### Эндпоинты сервера (Express)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | Статус (uptime, MQTT) |
| GET | `/api/session` | Текущая сессия (Kratos whoami) |
| POST | `/api/kratos/login` | Логин |
| POST | `/api/kratos/registration` | Регистрация |
| POST | `/api/kratos/recovery/init` | Инициализация recovery |
| POST | `/api/kratos/recovery` | Отправка recovery-ссылки |
| POST | `/api/kratos/recovery/submit` | Установка нового пароля |
| GET | `/api/mqtt/status` | Статус MQTT |
| GET | `/api/mqtt/subscriptions` | Список подписок |
| POST | `/api/mqtt/subscribe` | Подписаться на топик |
| POST | `/api/mqtt/unsubscribe` | Отписаться |
| POST | `/api/mqtt/publish` | Опубликовать сообщение |
| * | `/.ory/*` | Прокси на Kratos |

---

## 4. Предварительные требования

| Инструмент | Мин. версия | Проверка |
|---|---|---|
| Node.js | ≥ 22 LTS | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Docker + Compose | ≥ 27 | `docker --version` |
| git | — | `git --version` |

Проверочные команды можно запускать **из любого каталога** — это глобальные инструменты.

Установка всех зависимостей проекта (одна команда из корня):

```bash
# Выполнять из: корня проекта
npm run install:all
```

Что делает эта команда: она последовательно выполняет `cd server && npm install` и `cd ../client && npm install`. Альтернативно можно установить зависимости вручную по отдельности (см. раздел 5.2 и 5.3).

---

## 5. Локальная разработка

### 5.1 Инфраструктура (PostgreSQL + Kratos + Keto)

Dev-compose (`docker-compose.yml`) поднимает **только auth/RBAC-инфраструктуру** (Mosquitto, server и client в нём **нет**):

```bash
# Выполнять из: корня проекта
docker compose up -d
```

> ⚠️ **Обязательно из корня проекта.** Именно там лежит `docker-compose.yml`. Команда **не сработает** из `server/`, `client/` или любого другого каталога.

Ожидаемый результат:

```bash
# Выполнять из: корня проекта
docker compose ps
```

`kratos-db` (Up), `kratos` (Up), `keto` (Up), миграции (`kratos-migrate`, `keto-migrate`) — `Exited (0)`.

Проверить, что инфраструктура отвечает:

```bash
# Выполнять из: любого каталога (проверка по HTTP)
curl.exe http://localhost:4433/health/alive   # Kratos → {"status":"ok"}
curl.exe http://localhost:4466/health/ready   # Keto
```

> 💡 БД `keto` создаётся автоматически при первой инициализации Postgres скриптом `keto/init-keto.sql` (смонтирован в `/docker-entrypoint-initdb.d/`). Если volume БД уже существовал до добавления скрипта — создать БД вручную: `docker exec telemetry-kratos-db psql -U kratos -c "CREATE DATABASE keto;"`.

### 5.2 Express-сервер (нативно, hot-reload)

```bash
# Выполнять из: server/
cd server
npm ci
npm run dev          # tsx watch src/index.ts → :3000
```

> ⚠️ **Обязательно из `server/`.** Скрипт `npm run dev` описан в `server/package.json`, и сервер читает настройки из `server/.env`. Если запустить `npm run dev` из корня, команда не найдётся (в корне такого скрипта нет — вместо него есть корневой алиас `npm run dev:server`).

Сервер читает `server/.env` (`SERVE_CLIENT`, `KRATOS_PUBLIC_URL=http://localhost:4433`, `MQTT_BROKER_URL`, CORS и т.д.).

Альтернатива — корневой алиас (внутри сам делает `cd server`):

```bash
# Выполнять из: корня проекта
npm run dev:server
```

### 5.3 Angular-клиент (нативно, hot-reload)

```bash
# Выполнять из: client/
cd client
npm ci --legacy-peer-deps
npm run start        # ng serve → :4200, прокси /api и /.ory → :3000
```

> ⚠️ **Обязательно из `client/`.** `npm run start` описан в `client/package.json` (`ng serve`), а dev-прокси подхватывается из `client/proxy.conf.json`.

Открыть: `http://localhost:4200`.

Прокси настроен в `client/proxy.conf.json`: `/api` и `/.ory` идут на Express (:3000), который в свою очередь проксирует `/.ory` на Kratos (:4433).

Альтернатива — корневой алиас (внутри сам делает `cd client`):

```bash
# Выполнять из: корня проекта
npm run dev:client
```

### 5.4 Порядок запуска локальной разработки (краткая памятка)

1. Поднять инфраструктуру — **из корня**:

   ```bash
   # Выполнять из: корня проекта
   docker compose up -d
   ```

2. Запустить сервер — **из `server/`** (в отдельном терминале):

   ```bash
   # Выполнять из: server/
   npm run dev
   ```

3. Запустить клиент — **из `client/`** (в третьем терминале):

   ```bash
   # Выполнять из: client/
   npm run start
   ```

4. Открыть `http://localhost:4200`.

### 5.5 Альтернатива: Express раздаёт собранный клиент

Сначала собираем клиент (Angular), потом запускаем сервер с `SERVE_CLIENT=true`:

```bash
# Шаг 1 — сборка клиента. Выполнять из: client/
cd client
npm run build        # результат: client/dist/browser

# Шаг 2 — запуск сервера. Выполнять из: server/
cd ../server
npm run dev          # SERVE_CLIENT=true в server/.env
```

Открыть: `http://localhost:3000`.

> 💡 Сервер раздаёт статику из пути `../client/dist/browser`, который вычисляется **относительно текущего рабочего каталога сервера** (`server/`). Поэтому важно запускать `npm run dev` именно из `server/`, а не из корня — иначе путь до собранного клиента не найдётся.

### 5.6 MQTT в локальной разработке

- В dev-compose **нет Mosquitto** — его поднимают отдельным контейнером.
- `server/.env` уже настроен на локальный брокер: `MQTT_BROKER_URL=mqtt://localhost:1883` (значение `mqtt://mosquitto:1883` используется только когда сервер запущен в Docker).

Поднять Mosquitto (из корня проекта, чтобы подхватился `./mosquitto.conf`):

```bash
# Выполнять из: корня проекта
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 -v ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro -v mosquitto-data:/mosquitto/data -v mosquitto-log:/mosquitto/log eclipse-mosquitto:2
```

Если контейнер с именем `mosquitto` уже существует — сначала `docker rm -f mosquitto`.

Перезапустить сервер (`Ctrl+C`, затем снова `npm run dev` из `server/`). В логе появится:

```text
[MQTT] Подключён к mqtt://localhost:1883
[MQTT] Подписан на industrial/sensors/#
```

Проверка данных MQTT:

```bash
# 1) статус подключения — mqtt должен быть "connected" (из любого каталога)
curl.exe http://localhost:3000/api/health

# 2) подписка на брокере и публикация тестового сообщения
docker exec mosquitto mosquitto_sub -t "industrial/sensors/#" -v
docker exec mosquitto mosquitto_pub -t "industrial/sensors/temp" -m "temperature=42.5"

# 3) в логе сервера (server/dev-server.log) появится строка:
#    [Telemetry] industrial/sensors/temp → temperature=42.5
```

> 💡 Сервер подписывается на `industrial/sensors/#` — префикс `industrial/` задаётся `MQTT_TOPIC_PREFIX` в `server/.env`. Сопоставление wildcard-топиков (`+` / `#`) реализовано в `server/src/services/mqtt.service.ts`.

### 5.7 Остановка

```bash
# Выполнять из: корня проекта
docker compose down          # инфраструктура (данные БД сохраняются)

# Выполнять из: корня проекта
docker compose down -v       # с удалением данных БД
```

Dev-серверы (`npm run dev`, `npm run start`) останавливаются нажатием `Ctrl+C` в соответствующих терминалах.

---

## 6. Управление секретами

Секреты **не хранятся в git**. Реальные значения — в gitignored-файлах на ВМ, в репозитории только шаблоны.

| Шаблон (tracked) | Реальный файл (gitignored) | Содержимое |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD` |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | `secrets.cookie`, `secrets.cipher`, `courier.smtp.connection_uri` |
| `kratos/kratos.docker.example.yml` | `kratos/kratos.docker.yml` | `courier.smtp.connection_uri` (пароль приложения Яндекса) |

Оба файла лежат в **корне проекта** (`.env.yc`) и в **`kratos/`** (`kratos.yc.yml`) соответственно — это важно для запуска prod-команд из корня.

Генерация секретов Kratos (ровно 32 hex-символа). Команда не зависит от каталога:

```bash
# Выполнять из: любого каталога
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> ⚠️ Kratos требует `secrets.cookie`/`secrets.cipher` **ровно 32 символа** и **не поддерживает `${VAR}`** в конфиг-файле — секреты пишутся напрямую в `kratos/kratos.yc.yml`.

Локальные dev-конфиги Kratos: `kratos/kratos.yml` (порт 4000, плейсхолдеры) и `kratos/kratos.docker.yml` (порт 4433). `kratos.docker.yml` — gitignored: копируется из `kratos/kratos.docker.example.yml` и содержит реальный `courier.smtp.connection_uri` (пароль приложения Яндекса).

---

## 7. RBAC: роли и права

Роли: `admin`, `engineer`, `operator`. Ресурсы: `dashboard`, `mqtt`, `mqtt-topics`, `users`, `settings`.

| Ресурс | operator | engineer | admin |
|---|---|---|---|
| Dashboard | view | view + edit | полный |
| MQTT | view | view + edit | полный |
| MQTT Topics | view | view + edit | полный |
| Users | — | view | полный |
| Settings | — | view + edit | полный |

### Текущий статус (важно)

Код RBAC написан, но **ещё не активирован**:

- `ketoService.seedDefaults()` не вызывается при старте → роли/права не сидятся;
- `requirePermission`/`requireRole`/`loadPermissions` не применены к маршрутам `/api/mqtt/*`;
- маршрута `/api/permissions` нет, клиентский `PermissionsService.load()` не вызывается.

Сейчас `/api/mqtt/*` защищён только аутентификацией, а dashboard не переключается по ролям. Подключение RBAC — задача ближайшего спринта (`user-data/NEXT_STEPS.md`).

---

## 8. Продакшен (Yandex Cloud)

Полное руководство по развёртыванию — в `user-data/DEPLOYMENT_GUIDE.md`. Кратко:

- ВМ: Ubuntu 24.04, домен `industrial-telemetry.ru`, репозиторий публичный `github.com/mechtool/industrial-telemetry.git`.
- Доступ: `ssh yc-vm` (алиас в `~/.ssh/config`, ключ `~/.ssh/keys/yc-vm-key`).
- На ВМ репозиторий клонируется в `~/industrial-telemetry`, и **этот каталог становится «корнем проекта»** — все prod-команды выполняются из него.

Стек поднимается одной командой:

```bash
# Выполнять на ВМ из: ~/industrial-telemetry (корень проекта)
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

> ⚠️ **Из `~/industrial-telemetry`, не из любого другого каталога.** Здесь лежат `docker-compose.yc.yml`, `.env.yc`, `mosquitto.conf`, а также каталоги `server/` и `client/` для сборки образов. Все относительные пути в compose-файле разрешаются относительно этого каталога.

- Образы `it-server` и `it-client` собираются внутри Docker (Node на ВМ не нужен).
- Секреты читаются из `.env.yc` в том же каталоге (флаг `--env-file .env.yc`).

---

## 9. Обновление / деплой

### 9.1 Локально (коммит и push)

```bash
# Выполнять из: корня проекта (любой его подкаталог тоже подойдёт — git работает от корня репозитория)
git add -A
git commit -m "описание"
git push origin master
```

### 9.2 На ВМ (git pull + пересборка)

```bash
# Шаг 1 — зайти на ВМ (из любого каталога локальной машины)
ssh yc-vm

# Шаг 2 — перейти в корень проекта на ВМ
cd ~/industrial-telemetry

# Шаг 3 — забрать изменения
git pull origin master

# Шаг 4 — пересобрать изменённый сервис. Выполнять из: ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc build client   # и/или server
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d client
```

> ⚠️ Все команды `docker compose -f docker-compose.yc.yml ...` в шаге 4 выполняются **из `~/industrial-telemetry`** — только там `docker-compose.yc.yml` и `.env.yc` видны compose-у.

Сопоставление «что пересобирать»:
- изменился Angular → `build client`;
- изменился сервер → `build server`;
- изменились конфиги Kratos/Keto/Mosquitto → `up -d <сервис>` (конфиги — volume, пересборка не нужна).

> 💡 Корневой `package.json` содержит алиасы `docker:yc:up`, `docker:yc:build`, `docker:yc:logs`, `docker:yc:down`. Учтите: `docker:yc:up` и `docker:yc:build` сначала выполняют `npm run build:client` (локальная сборка Angular), хотя сам Dockerfile тоже собирает Angular внутри контейнера — то есть локальная сборка там избыточна. Для деплоя надёжнее вызывать `docker compose -f docker-compose.yc.yml ...` напрямую из корня.

---

## 10. Проверка работоспособности

### 10.1 Prod (на ВМ, из корня проекта)

```bash
# Выполнять на ВМ из: ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# HTTP-проверки (можно из любого каталога)
curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy",...,"mqtt":"connected"}}

curl -s https://industrial-telemetry.ru/.ory/health/alive   # → {"status":"ok"}

# Проверка Keto изнутри контейнера (можно из любого каталога)
docker exec it-keto wget -qO- http://localhost:4466/health/ready

# Главная страница
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/   # → 200
```

### 10.2 Dev (локально)

```bash
# Инфраструктура — проверить статус. Выполнять из: корня проекта
docker compose ps

# HTTP-проверки (можно из любого каталога; на Windows — curl.exe или Invoke-RestMethod)
curl.exe http://localhost:3000/api/health
curl.exe http://localhost:4433/health/alive
curl.exe http://localhost:4466/health/ready
```

---

## 11. Устранение неполадок

| Симптом | Причина | Решение |
|---|---|---|
| `Warn Provider stream connection dropped while reading` / `ENOTFOUND mosquitto` | MQTT-брокер недоступен (локально Mosquitto не запущен; в Docker — имя `mosquitto` не резолвится) | поднять Mosquitto (раздел 5.6) и проверить `MQTT_BROKER_URL` в `server/.env`; не критично |
| `docker compose up -d` → «no configuration file provided» / не находит конфиги | команда запущена не из корня проекта | выполнить `cd` в корень (`docker-compose.yml` лежит там) и повторить |
| `npm run dev` → «Missing script: dev» | команда запущена из корня, а не из `server/` | выполнить `cd server` или использовать корневой алиас `npm run dev:server` |
| `npm run start` → «Missing script: start» | команда запущена не из `client/` | выполнить `cd client` или использовать корневой алиас `npm run dev:client` |
| Сервер с `SERVE_CLIENT=true` отдаёт 404 на главной | сервер запущен не из `server/`, путь `../client/dist/browser` не резолвится | запускать `npm run dev` строго из `server/` |
| `nginx 502 Bad Gateway` на `/api` | контейнер `it-server` упал | `docker logs it-server`; типичная причина — путь запуска в `Dockerfile.server` |
| Kratos `Restarting` / `secrets.cipher length must be >= 32` | секрет не ровно 32 символа | сгенерировать `randomBytes(16).toString('hex')` и прописать в `kratos/kratos.yc.yml` |
| Kratos `does not match pattern "^smtps?://"` | `courier.smtp.connection_uri` пуст/неверен | прописать реальный `smtps://...` URI |
| `git pull` на ВМ падает с «could not read Username» | репозиторий приватный / нет креденшелов | репозиторий уже публичный; если снова приватный — добавить креденшелы |
| После force-push локальный клон разошёлся | история переписана | `git fetch origin && git reset --hard origin/master` |

Просмотр логов:

```bash
# Prod-логи — выполнять на ВМ из: ~/industrial-telemetry (можно также из любого каталога, указав полный путь к compose-файлу)
docker logs -f it-kratos
docker logs -f it-server
docker logs -f it-client
docker logs -f it-keto
docker logs -f it-mosquitto

# Dev-логи инфраструктуры — выполнять из: корня проекта
docker compose logs -f
```

---

## 12. Шпаргалка команд

Каждая команда помечена каталогом запуска.

```bash
# ==========================================================
# ---- ЛОКАЛЬНО ----
# ==========================================================

# Установить зависимости (server + client) — из КОРНЯ ПРОЕКТА
npm run install:all

# Поднять dev-инфраструктуру (postgres + kratos + keto) — из КОРНЯ ПРОЕКТА
docker compose up -d

# Mosquitto локально (MQTT) — из КОРНЯ ПРОЕКТА
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 -v ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro -v mosquitto-data:/mosquitto/data -v mosquitto-log:/mosquitto/log eclipse-mosquitto:2

# Проверка данных MQTT — из любого каталога
docker exec mosquitto mosquitto_pub -t "industrial/sensors/temp" -m "temperature=42.5"
docker exec mosquitto mosquitto_sub -t "industrial/sensors/#" -v

# Express :3000 (tsx watch) — из server/
cd server && npm run dev
#   (алиас из корня: npm run dev:server)

# Angular :4200 — из client/
cd client && npm run start
#   (алиас из корня: npm run dev:client)

# Сборка клиента — из client/
cd client && npm run build
#   (алиас из корня: npm run build:client)

# Сборка сервера — из server/
cd server && npm run build
#   (алиас из корня: npm run build:server)

# Остановить dev-инфраструктуру — из КОРНЯ ПРОЕКТА
docker compose down          # данные БД сохраняются
docker compose down -v       # с удалением данных БД


# ==========================================================
# ---- ПРОД (НА ВМ) ----
# ==========================================================

# Зайти на ВМ (из любого каталога)
ssh yc-vm

# Перейти в корень проекта на ВМ
cd ~/industrial-telemetry

# Забрать изменения
git pull origin master

# Статус стека — из ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# Пересобрать образы — из ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc build client server

# Поднять/обновить стек — из ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d

# Логи — из ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc logs -f
```

### Итоговая таблица «что откуда запускать»

| Команда | Каталог запуска |
|---|---|
| `docker compose up -d` / `down` / `ps` / `logs` (dev) | **корень проекта** |
| `docker compose -f docker-compose.yc.yml --env-file .env.yc ...` (prod) | **корень проекта** (на ВМ — `~/industrial-telemetry`) |
| `npm run install:all`, `npm run dev:server`, `npm run dev:client`, `npm run build:server`, `npm run build:client` | **корень проекта** |
| `npm ci`, `npm run dev`, `npm run build` (сервер) | **`server/`** |
| `npm ci --legacy-peer-deps`, `npm run start`, `npm run build` (клиент) | **`client/`** |
| `git add` / `commit` / `push` / `pull` | любой каталог внутри репозитория (git сам находит корень) |
| `ssh yc-vm`, `node -e ...`, `curl`/`curl.exe`, `docker exec` | любой каталог |
