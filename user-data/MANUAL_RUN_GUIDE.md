# Industrial Telemetry — Руководство по запуску и эксплуатации

**Версия:** 3.0
**Дата:** 2026-08-15
**Стек:** Angular 22 (PWA, NG-ZORRO) · Express (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14 · PostgreSQL 16 · Nginx

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Компоненты](#2-компоненты)
3. [Предварительные требования](#3-предварительные-требования)
4. [Локальная разработка](#4-локальная-разработка)
5. [Управление секретами](#5-управление-секретами)
6. [RBAC: роли и права](#6-rbac-роли-и-права)
7. [Продакшен (Yandex Cloud)](#7-продакшен-yandex-cloud)
8. [Обновление / деплой](#8-обновление--деплой)
9. [Проверка работоспособности](#9-проверка-работоспособности)
10. [Устранение неполадок](#10-устранение-неполадок)
11. [Шпаргалка команд](#11-шпаргалка-команд)

---

## 1. Архитектура

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

## 2. Компоненты

| Сервис | Назначение | Порты | Образ / технология |
|---|---|---|---|
| **PostgreSQL 16** | БД (Kratos + Keto) | 5432 | `postgres:16-alpine` |
| **Kratos Migrate** | Миграция схемы (одноразовая) | — | `oryd/kratos:v1.3.1` |
| **Ory Kratos** | Identity Provider (регистрация, логин, recovery, verification) | 4433 (public), 4434 (admin) | `oryd/kratos:v1.3.1` |
| **Keto Migrate** | Миграция схемы (одноразовая) | — | `oryd/keto:v0.14.0-alpha.0` |
| **Ory Keto** | Permission Server (RBAC) | 4466 (read), 4467 (write) | `oryd/keto:v0.14.0-alpha.0` |
| **Mosquitto** | MQTT-брокер (телеметрия) | 1883 | `eclipse-mosquitto:2` |
| **Express Server** | API: health, прокси Kratos, Keto-клиент, MQTT-мост | 3000 | Node.js 22 + TypeScript |
| **Nginx + Angular** | Reverse-proxy + раздача PWA | 80, 443 | `nginx:1.27-alpine` + Angular 22 |

### Маршруты клиента (Angular)

| Путь | Компонент |
|---|---|
| `/`, `/login` | Вход (`kratos-auth`) |
| `/registration` | Регистрация (`kratos-auth`, режим registration) |
| `/verification` | Верификация email |
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
| POST | `/api/kratos/verification` | Верификация email |
| GET | `/api/mqtt/status` | Статус MQTT |
| GET | `/api/mqtt/subscriptions` | Список подписок |
| POST | `/api/mqtt/subscribe` | Подписаться на топик |
| POST | `/api/mqtt/unsubscribe` | Отписаться |
| POST | `/api/mqtt/publish` | Опубликовать сообщение |
| * | `/.ory/*` | Прокси на Kratos |

---

## 3. Предварительные требования

| Инструмент | Мин. версия | Проверка |
|---|---|---|
| Node.js | ≥ 22 LTS | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Docker + Compose | ≥ 27 | `docker --version` |
| git | — | `git --version` |

Установка всех зависимостей проекта:

```bash
npm run install:all
```

---

## 4. Локальная разработка

### 4.1 Инфраструктура (PostgreSQL + Kratos + Keto)

Dev-compose (`docker-compose.yml`) поднимает **только auth/RBAC-инфраструктуру** (Mosquitto, server и client в нём нет):

```bash
docker compose up -d
```

Ожидаемый результат: `kratos-db` (Up), `kratos` (Up), `keto` (Up), миграции (`kratos-migrate`, `keto-migrate`) — `Exited (0)`.

### 4.2 Express-сервер (нативно, hot-reload)

```bash
cd server
npm ci
npm run dev          # tsx watch src/index.ts → :3000
```

Сервер читает `server/.env` (`SERVE_CLIENT`, `KRATOS_PUBLIC_URL=http://localhost:4433`, CORS и т.д.).

### 4.3 Angular-клиент (нативно, hot-reload)

```bash
cd client
npm ci --legacy-peer-deps
npm run start        # ng serve → :4200, прокси /api и /.ory → :3000
```

Открыть: `http://localhost:4200`.

Прокси настроен в `client/proxy.conf.json`: `/api` и `/.ory` идут на Express (:3000), который в свою очередь проксирует `/.ory` на Kratos (:4433).

### 4.4 Альтернатива: Express раздаёт собранный клиент

```bash
cd client && npm run build && cd ..
cd server && npm run dev    # SERVE_CLIENT=true
```

Открыть: `http://localhost:3000`.

### 4.5 MQTT в локальной разработке

- В dev-compose **нет Mosquitto** — при нативном запуске сервер не может достучаться до `mqtt://mosquitto:1883` (это Docker-имя хоста).
- В консоли появится предупреждение `Warn Provider stream connection dropped while reading` и в логе сервера `MQTT недоступен — сервер работает без MQTT`. Это не критично — приложение работает без MQTT.

Чтобы включить MQTT локально:

```bash
docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto:2
# и в server/.env поменять:
#   MQTT_BROKER_URL=mqtt://localhost:1883
```

### 4.6 Остановка

```bash
docker compose down          # инфраструктура (данные БД сохраняются)
docker compose down -v       # с удалением данных БД
# dev-серверы: Ctrl+C
```

---

## 5. Управление секретами

Секреты **не хранятся в git**. Реальные значения — в gitignored-файлах на ВМ, в репозитории только шаблоны.

| Шаблон (tracked) | Реальный файл (gitignored) | Содержимое |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD` |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | `secrets.cookie`, `secrets.cipher`, `courier.smtp.connection_uri` |

Генерация секретов Kratos (ровно 32 hex-символа):

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> ⚠️ Kratos требует `secrets.cookie`/`secrets.cipher` **ровно 32 символа** и **не поддерживает `${VAR}`** в конфиг-файле — секреты пишутся напрямую в `kratos/kratos.yc.yml`.

Локальные dev-конфиги Kratos: `kratos/kratos.yml` (порт 4000) и `kratos/kratos.docker.yml` (порт 4433) — содержат только плейсхолдеры.

---

## 6. RBAC: роли и права

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

## 7. Продакшен (Yandex Cloud)

Полное руководство по развёртыванию — в `user-data/DEPLOYMENT_GUIDE.md`. Кратко:

- ВМ: Ubuntu 24.04, домен `industrial-telemetry.ru`, репозиторий публичный `github.com/mechtool/industrial-telemetry.git`.
- Доступ: `ssh yc-vm` (алиас в `~/.ssh/config`, ключ `~/.ssh/keys/yc-vm-key`).
- Стек поднимается `docker compose -f docker-compose.yc.yml --env-file .env.yc up -d`.
- Образы `it-server` и `it-client` собираются внутри Docker (Node на ВМ не нужен).

---

## 8. Обновление / деплой

### 8.1 Локально

```bash
git add -A
git commit -m "описание"
git push origin master
```

### 8.2 На ВМ (git pull + пересборка)

```bash
ssh yc-vm
cd ~/industrial-telemetry
git pull origin master

# пересобрать изменённый сервис:
docker compose -f docker-compose.yc.yml --env-file .env.yc build client   # и/или server
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d client
```

Сопоставление «что пересобирать»:
- изменился Angular → `build client`;
- изменился сервер → `build server`;
- изменились конфиги Kratos/Keto/Mosquitto → `up -d <сервис>` (конфиги — volume, пересборка не нужна).

---

## 9. Проверка работоспособности

```bash
# контейнеры
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# Express
curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy",...,"mqtt":"connected"}}

# Kratos
curl -s https://industrial-telemetry.ru/.ory/health/alive   # → {"status":"ok"}

# Keto
docker exec it-keto wget -qO- http://localhost:4466/health/ready

# главная
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/   # → 200
```

Dev-проверки:

```bash
curl http://localhost:3000/api/health
curl http://localhost:4433/health/alive
curl http://localhost:4466/health/ready
```

---

## 10. Устранение неполадок

| Симптом | Причина | Решение |
|---|---|---|
| `Warn Provider stream connection dropped while reading` | MQTT-брокер недоступен (в dev — имя `mosquitto` не резолвится вне Docker) | поднять Mosquitto или сменить `MQTT_BROKER_URL` на `localhost`; не критично |
| `nginx 502 Bad Gateway` на `/api` | контейнер `it-server` упал | `docker logs it-server`; типичная причина — путь запуска в `Dockerfile.server` |
| Kratos `Restarting` / `secrets.cipher length must be >= 32` | секрет не ровно 32 символа | сгенерировать `randomBytes(16).toString('hex')` и прописать в `kratos/kratos.yc.yml` |
| Kratos `does not match pattern "^smtps?://"` | `courier.smtp.connection_uri` пуст/неверен | прописать реальный `smtps://...` URI |
| `git pull` на ВМ падает с «could not read Username» | репозиторий приватный / нет креденшелов | репозиторий уже публичный; если снова приватный — добавить креденшелы |
| После force-push локальный клон разошёлся | история переписана | `git fetch origin && git reset --hard origin/master` |

Просмотр логов:

```bash
docker logs -f it-kratos
docker logs -f it-server
docker logs -f it-client
docker logs -f it-keto
docker logs -f it-mosquitto
```

---

## 11. Шпаргалка команд

```bash
# ---- локально ----
npm run install:all
docker compose up -d                      # dev-инфраструктура (postgres+kratos+keto)
npm run dev:server                        # Express :3000 (tsx watch)
npm run dev:client                        # Angular :4200
npm run build:client                      # сборка клиента
npm run build:server                      # сборка сервера

# ---- прод (ВМ) ----
ssh yc-vm
cd ~/industrial-telemetry
git pull origin master
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
docker compose -f docker-compose.yc.yml --env-file .env.yc build client server
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
docker compose -f docker-compose.yc.yml --env-file .env.yc logs -f
```
