# Industrial Telemetry — Руководство по запуску и эксплуатации

**Версия:** 7.0
**Дата:** 2026-11-14
**Стек:** Angular 22 (PWA, NG-ZORRO, zoneless) · Express 4 (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14.0 · PostgreSQL 16 · Nginx

> Сверено с кодом на `master` (HEAD `1d8eca1`). Что изменилось к v7.0:
> - добавлена **пошаговая инструкция первого запуска «с нуля»** (окружение → сервер → клиент) и **самостоятельного развёртывания в облаке** (§5.0 и §8);
> - регистрация стала **двухшаговой**: `POST /api/kratos/registration` создаёт ожидающую (pending) запись и шлёт ссылку подтверждения, identity в Kratos создаётся только после клика по ссылке `/api/kratos/verify-email`;
> - разделены два SMTP-канала: `SMTP_URI` (Kratos, письма восстановления пароля) и `SMTP_URL`/`MAIL_FROM`/`APP_BASE_URL` (сервер, письма подтверждения регистрации);
> - демо-панель `/presentation/dashboard` переведена на bento-сетку (8 параметров + графики слева, аварии и «Вызовы сервисным компаниям» справа); PWA-иконки — монограмма «IT».

---

## Оглавление

1. [Карта каталогов](#1-карта-каталогов-что-откуда-запускать)
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
├── README.md                          ← обзор проекта (краткий)
├── docker-compose.yml                 ← dev-инфраструктура (запуск ИЗ КОРНЯ)
├── docker-compose.yc.yml              ← prod-стек (запуск ИЗ КОРНЯ, с .env.yc)
├── .env / .env.yc                     ← локальные/prod-секреты (gitignored)
├── .env.yc.example                    ← шаблон prod-секретов
├── package.json                       ← корневые npm-скрипты
├── Dockerfile.server                  ← сборка Express + keeper (общий образ)
├── Dockerfile.client                  ← сборка Angular + Nginx
├── mosquitto.conf                     ← конфиг MQTT-брокера
├── cloud-config.yaml                  ← cloud-init для создания ВМ
├── server/                            ← Express-бэкенд + сервис-хранитель телеметрии
│   ├── package.json
│   ├── .env.example                   ← шаблон локальных настроек сервера (cp → .env)
│   ├── .env                           ← локальные настройки сервера (gitignored)
│   └── src/                           ← index.ts, keeper.ts, config, routes, services, middleware, scripts
├── client/                            ← Angular-клиент (npm-команды ИЗ client/)
│   ├── package.json
│   └── proxy.conf.json                ← dev-прокси /api и /.ory → :3000
├── gateway/                           ← шлюз Waveshare MQTT+JSON: дизайн CSV, схема, скрипты, backup
├── kratos/                            ← конфиги Kratos (монтируются в Docker)
├── keto/                              ← конфиги Keto (монтируются в Docker)
├── nginx/                             ← prod-конфиг Nginx (nginx.yc.conf)
├── scripts/                           ← deploy-yc.sh, setup-https.sh, renew-cert.sh, generate-icons.js,
│                                        set-postbox-smtp.ps1, test-postbox-smtp.mjs, telemetry-schema.sql
└── user-data/                         ← документация (этот файл, DEPLOYMENT_GUIDE.md, DEVELOPMENT_PLAN.md и др.)
    └── archive/                       ← архивные заметки сессий (история, рецепты)
```

### 1.2 Ключевое правило

Есть **ровно три каталога**, из которых что-то запускается:

| Каталог | Что в нём запускают |
|---|---|
| **Корень проекта** | `docker compose ...` (dev и prod), корневые npm-скрипты (`install:all`, `dev:server`, `dev:client`, `build:*`, `keeper:*`, `telemetry:*`, `docker:yc:*`) |
| **`server/`** | `npm ci`, `npm run dev`, `npm run build`, `npm run start`, `npm run keeper:dev`, `npm run keeper:start`, `npm run migrate:roles`, `npm run seed:presentation` |
| **`client/`** | `npm ci --legacy-peer-deps`, `npm run start`, `npm run build`, `npm run watch`, `npm test` |

Каталоги `kratos/`, `keto/`, `nginx/`, `scripts/`, `gateway/`, `user-data/` — **только файлы** (конфиги, скрипты, документация). Из них ничего не запускается вручную в ежедневной работе.

> 💡 **`docker compose` только из корня.** `docker-compose.yml` и `docker-compose.yc.yml` лежат в корне, а все относительные пути внутри (`./kratos`, `./keto`, `./mosquitto.conf`, `build.context: ./server`) разрешаются относительно расположения compose-файла.

> 💡 **Windows / PowerShell.** На машине разработчика команды `docker compose`, `npm`, `node`, `git` выглядят одинаково. Для HTTP-проверок используйте `curl.exe` (PowerShell-алиас `curl` — это `Invoke-WebRequest` и работает иначе) либо `Invoke-RestMethod`. На ВМ (Ubuntu, bash) — обычный `curl`.

---

## 2. Архитектура

```
                       Браузер
          http://localhost:4200  (dev, Angular CLI + proxy)
          http://localhost:3000  (dev, Express раздаёт собранную статику при SERVE_CLIENT=true)
          https://industrial-telemetry.ru  (prod)

        ┌──────────────────────┐
        ▼                      ▼
   Nginx :80/:443        Express API :3000          Angular CLI :4200
   (только prod)         (Keto-клиент + MQTT-мост)  (dev-сервер + proxy)
        │                      │
        ├─► /.ory ──► Kratos :4433
        │                      ├─► Keto :4466/4467
        │                      └─► Mosquitto :1883
        └──► PostgreSQL :5432 ◄── (базы kratos, keto, telemetry)

   Шлюз Waveshare (на объекте) ──MQTT──► Mosquitto ──► keeper (server/src/keeper.ts) ──► PostgreSQL `telemetry`
```

- **Dev**: Nginx не участвует; `/api` и `/.ory` проксируются Angular CLI → Express → Kratos.
- **Prod**: Nginx — единая точка входа (80/443), статика Angular + reverse-proxy на `/api` и `/.ory`.
- **Телеметрия**: шлюз публикует JSON напрямую в Mosquitto; отдельный процесс `keeper` подписывается, нормализует и пишет в БД.
- **Регистрация (email-верификация)**: `POST /api/kratos/registration` → сервер сохраняет pending-запись и шлёт письмо (nodemailer) → пользователь кликает ссылку `/api/kratos/verify-email` → сервер создаёт identity в Kratos и назначает роль `viewer`.

---

## 3. Компоненты

### 3.1 Сервисы

| Сервис | Назначение | Порты | Образ / технология |
|---|---|---|---|
| PostgreSQL 16 | БД (Kratos + Keto + telemetry) | 5432 | `postgres:16-alpine` |
| Kratos Migrate | Миграция схемы (одноразовая) | — | `oryd/kratos:v1.3.1` |
| Ory Kratos | Identity Provider (регистрация, логин, recovery) | 4433 (public), 4434 (admin) | `oryd/kratos:v1.3.1` |
| Keto Migrate | Миграция схемы (одноразовая) | — | `oryd/keto:v0.14.0` |
| Ory Keto | Permission Server (RBAC) | 4466 (read), 4467 (write) | `oryd/keto:v0.14.0` |
| Mosquitto | MQTT-брокер | 1883 (и 9001 WebSocket в dev) | `eclipse-mosquitto:2` |
| Express Server | API: health, прокси Kratos, Keto-клиент, MQTT-мост, DaData, письма регистрации | 3000 | Node.js 22 + TypeScript |
| Keeper | Хранитель телеметрии: MQTT → normalize → PostgreSQL | 3100 (health) | тот же образ `Dockerfile.server` |
| Telemetry Migrate | Создание БД `telemetry` + схема (одноразовая) | — | `postgres:16-alpine` |
| Nginx + Angular | Reverse-proxy + раздача PWA | 80, 443 | `nginx:1.27-alpine` + Angular 22 |
| MailSlurper (только dev) | Локальный SMTP-перехватчик | 1025 (SMTP), 4436/4437 (Web UI) | `oryd/mailslurper:latest-smtps` |

> В dev-compose `keeper` и `telemetry-migrate` включены профилем `telemetry`; в prod-compose (`docker-compose.yc.yml`) они поднимаются по умолчанию.

### 3.2 Маршруты клиента (Angular)

| Путь | Компонент | Назначение |
|---|---|---|
| `/login` | `auth-login` | Вход |
| `/registration` | `auth-registration` | Регистрация (шаг 1 — форма) |
| `/check-email` | `auth-check-email` | «Проверьте почту» (шаг 2, ожидание клика по ссылке) |
| `/verify-email` | `auth-verify-email` | Результат клика по ссылке подтверждения (`?invalid=1` — ссылка недействительна) |
| `/recovery` | `auth-recovery` | Восстановление пароля |
| `/link-sent` | `auth-link-sent` | «Ссылка отправлена» (восстановление) |
| `/change-password` | `auth-change-password` | Смена пароля (settings-флоу) |
| `/` | `app-shell` → `main-entrance` | Главная «CRYOMON» (после входа) |
| `/projects` | `projects` (list / tiles / empty) | Список проектов |
| `/projects/:id` | `project-view` | Карточка проекта (вкладки) |
| `/settings` | `settings` | Настройки приложения (отдельная страница) |
| `/presentation` | `presentation` (retail / service) | Публичная презентация (демо-почта) |
| `/presentation/dashboard` | `presentation-dashboard` | Демо-панель мониторинга: bento-сетка 2:1 (8 параметров + графики слева, аварии и «Вызовы сервисным компаниям» справа) |
| `/main-entrance` | — | redirect на `/` |
| `**` | — | redirect на `/` |

Защита: `/` (оболочка), `/projects` и `/settings` — за `authGuard`; `/presentation` — за `presentationGuard` (только демо-почты `service@telemetry.ru` / `retail@telemetry.ru`).

Карточка проекта (`/projects/:id`) имеет вкладки: **Общие, Панель управления, Объекты, Данные, Шлюзы, Организации, Триггеры, Пользователи**. Реализованы Общие/Панель/Объекты/Шлюзы/Организации/Пользователи; «Данные» и «Триггеры» — заглушки (см. `DEVELOPMENT_PLAN.md`).

> Профиль пользователя открывается модальным окном (клик по аватару в шапке), это не отдельный маршрут.

### 3.3 Эндпоинты сервера (Express)

| Метод | Путь | Назначение | Доступ |
|---|---|---|---|
| GET | `/api/health` | Статус (uptime, MQTT) | публичный |
| GET | `/api/session` | Текущая сессия (id, email, username, roles, department) | `kratosAuth` |
| POST | `/api/kratos/login` | Логин (проверяет, что email зарегистрирован) | публичный |
| POST | `/api/kratos/registration` | Регистрация: создаёт pending-запись и шлёт ссылку подтверждения | публичный |
| POST | `/api/kratos/registration/resend` | Повторно отправить ссылку подтверждения | публичный |
| POST | `/api/kratos/registration/invalidate` | Отменить отправленную ссылку | публичный |
| GET | `/api/kratos/verify-email?token=` | Клик по ссылке: создаёт identity в Kratos + роль `viewer`, редирект в приложение | публичный |
| POST | `/api/kratos/recovery/init` | Инициализация recovery | публичный |
| POST | `/api/kratos/recovery` | Отправка recovery-ссылки (письмо шлёт Kratos через `SMTP_URI`) | публичный |
| GET | `/api/kratos/recovery` | Данные recovery-флоу | публичный |
| POST | `/api/kratos/recovery/submit` | Установка нового пароля | публичный |
| POST | `/api/kratos/logout` | Выход (прокси Kratos) | публичный |
| POST | `/api/webhooks/registration` | Webhook Kratos → назначить `viewer` | секрет `WEBHOOK_SECRET` |
| GET | `/api/mqtt/status` | Статус MQTT + подписки | `kratosAuth` |
| GET | `/api/mqtt/subscriptions` | Список подписок | `kratosAuth` |
| POST | `/api/mqtt/subscribe` | Подписаться на топик | `kratosAuth` |
| POST | `/api/mqtt/unsubscribe` | Отписаться | `kratosAuth` |
| POST | `/api/mqtt/publish` | Опубликовать сообщение | `kratosAuth` |
| GET | `/api/projects` | Проекты текущего пользователя | `kratosAuth` |
| POST | `/api/projects` | Создать проект | `kratosAuth` |
| GET | `/api/users` | Список пользователей + роли | `kratosAuth` + `requireAdmin` |
| PUT | `/api/users/:id/roles` | Изменить роли пользователя | `kratosAuth` + `requireAdmin` |
| GET | `/api/settings` | Текущие настройки | `kratosAuth` |
| PUT | `/api/settings` | Обновить настройки | `kratosAuth` + `requireAdmin` |
| GET | `/api/address/suggest?query=` | Подсказки адресов РФ (DaData) | `kratosAuth` |
| * | `/.ory/*` | Прокси на Kratos | публичный (Kratos сам управляет флоу) |

> `/api/projects` и `/api/settings` — in-memory заглушки (см. §7.2). API телеметрии (`/api/telemetry/*`) пока нет — данные пишутся в БД keeper'ом, но клиент их не читает (см. `DEVELOPMENT_PLAN.md`).

---

## 4. Предварительные требования

| Инструмент | Мин. версия | Проверка |
|---|---|---|
| Node.js | ≥ 22 LTS | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Docker + Compose | ≥ 27 | `docker --version` |
| git | — | `git --version` |

Проверить всё сразу (PowerShell / bash):

```bash
node --version; npm --version; docker --version; git --version
```

Установка всех зависимостей (одна команда из корня):

```bash
npm run install:all
```

Команда последовательно выполняет `cd server && npm install` и `cd ../client && npm install`.

> 💡 Если ставите зависимости вручную (не через `install:all`), для клиента используйте `npm ci --legacy-peer-deps` — Angular 22 + NG-ZORRO дают расхождения peer-зависимостей, из-за которых обычный `npm ci` может упасть. При чистой установке предпочтителен `npm ci` (воспроизводимые версии из `package-lock.json`); `--legacy-peer-deps` нужен и для `server`, и для `client` (как в `Dockerfile.server`/`Dockerfile.client`).

---

## 5. Локальная разработка

### 5.0 Полная последовательность первого запуска (с нуля)

Ниже — минимальный путь от чистого клона до работающего приложения в браузере. Каждый шаг сопровождается ожидаемым результатом, чтобы можно было сразу понять, на каком шаге что-то пошло не так.

**Этап A. Подготовка (один раз)**

1. **Клонировать репозиторий и установить зависимости**

   ```bash
   git clone https://github.com/mechtool/industrial-telemetry.git
   cd industrial-telemetry
   npm run install:all
   ```

2. **Создать dev-конфиг Kratos** (иначе контейнер `kratos` упадёт при старте):

   ```bash
   # Windows PowerShell:
   Copy-Item kratos/kratos.docker.example.yml kratos/kratos.docker.yml
   # Linux/macOS:
   # cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml
   ```

3. **Создать `server/.env` из шаблона:** `cp server/.env.example server/.env` (Windows: `Copy-Item server/.env.example server/.env`). Файл gitignored. Ниже — содержимое шаблона (уже настроено на dev-окружение):

   ```ini
   PORT=3000
   SERVE_CLIENT=false

   KRATOS_PUBLIC_URL=http://localhost:4433
   KRATOS_ADMIN_URL=http://localhost:4434
   KETO_READ_URL=http://localhost:4466
   KETO_WRITE_URL=http://localhost:4467

   MQTT_BROKER_URL=mqtt://localhost:1883
   MQTT_TOPIC_PREFIX=industrial/

   # Должно совпадать с web_hook.auth.config.value в kratos/kratos.docker.yml
   WEBHOOK_SECRET=change-me-webhook-secret

   # Почта (письма подтверждения регистрации → MailSlurper, см. http://localhost:4436)
   SMTP_URL=smtps://localhost:1025
   SMTP_REJECT_UNAUTHORIZED=false
   MAIL_FROM=noreply@industrial-telemetry.ru
   APP_BASE_URL=http://localhost:3000

   # DaData (подсказки адресов РФ) — необязательно
   DADATA_API_KEY=
   ```

   > `SERVE_CLIENT=false` важно: иначе сервер в dev-режиме попытается раздавать `../client/dist/browser` (см. §5.7) и перехватит SPA-маршруты.

**Этап B. Окружение (Docker-инфраструктура)**

4. **Поднять инфраструктуру** (PostgreSQL + Kratos + Keto + MailSlurper + Mosquitto) — из корня:

   ```bash
   docker compose up -d
   ```

   Ожидаемый результат `docker compose ps`: `telemetry-kratos-db` (Up/healthy), `telemetry-kratos` (Up), `telemetry-keto` (Up), `telemetry-mailslurper` (Up), `telemetry-mosquitto` (Up), миграции `telemetry-kratos-migrate`/`telemetry-keto-migrate` — `Exited (0)`.

5. **Проверить инфраструктуру:**

   ```bash
   curl.exe http://localhost:4433/health/alive   # Kratos → {"status":"ok"}
   curl.exe http://localhost:4466/health/ready   # Keto
   ```

**Этап C. Сервер**

6. **Запустить Express** — из `server/` (в отдельном терминале):

   ```bash
   cd server
   npm run dev          # tsx watch src/index.ts → http://localhost:3000
   ```

   Ожидаемый результат в логе: `[Server] Industrial Telemetry API запущен на http://localhost:3000`. Если MQTT не поднят — не критично, сервер стартует и без него (`[MQTT] Недоступен ...`).

7. **Проверить сервер:**

   ```bash
   curl.exe http://localhost:3000/api/health
   # → {"success":true,"data":{"status":"healthy","uptime":...,"mqtt":"connected"}}
   ```

**Этап D. Клиент**

8. **Запустить Angular** — из `client/` (в ещё одном терминале):

   ```bash
   cd client
   npm run start        # ng serve → http://localhost:4200
   ```

   Ожидаемый результат: компиляция без ошибок и строка `Local: http://localhost:4200/`.

9. **Открыть приложение:** `http://localhost:4200`.

**Этап E. Проверка end-to-end (опционально, но полезно)**

10. Зарегистрироваться (`/registration`) → появится экран «Проверьте почту» → письмо уйдёт в MailSlurper (`http://localhost:4436`, SMTP-порт 1025) → открыть письмо и кликнуть ссылку → редирект в приложение, роль `viewer` назначена.

11. **Телеметрия** (необязательно, см. §5.5):

    ```bash
    docker compose --profile telemetry up -d telemetry-migrate keeper
    curl.exe http://localhost:3100/health
    ```

### 5.1 Инфраструктура (PostgreSQL + Kratos + Keto + MailSlurper + Mosquitto)

Dev-compose (`docker-compose.yml`) поднимает: `kratos-db`, `kratos-migrate`, `kratos`, `keto-migrate`, `keto`, `mailslurper`, `mosquitto`. Server и client в нём **нет** — они запускаются отдельно.

> ⚠️ Перед первым запуском скопировать dev-конфиг Kratos:
>
> ```bash
> cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml
> ```
>
> В `kratos.docker.yml` SMTP-плейсхолдер `__SMTP_URI__` подставляется из переменной `SMTP_URI` (compose делает это через `sed`). Для локальной отладки recovery-писем задайте в корневом `.env`: `SMTP_URI=smtp://mailslurper:1025`. При желании подставьте реальный SMTP либо оставьте пустым (тогда recovery-письма не уходят).

```bash
# Выполнять из: корня проекта
docker compose up -d
```

Ожидаемый результат (`docker compose ps` из корня): `kratos-db` (Up/healthy), `kratos` (Up), `keto` (Up), `mailslurper` (Up), `mosquitto` (Up), миграции `kratos-migrate`/`keto-migrate` — `Exited (0)`.

Проверка инфраструктуры:

```bash
curl.exe http://localhost:4433/health/alive   # Kratos → {"status":"ok"}
curl.exe http://localhost:4466/health/ready   # Keto
```

### 5.2 Express-сервер (нативно, hot-reload)

```bash
# Выполнять из: server/
cd server
npm ci
npm run dev          # tsx watch src/index.ts → :3000
```

Сервер читает `server/.env`: `SERVE_CLIENT`, `KRATOS_PUBLIC_URL`, `KRATOS_ADMIN_URL`, `KETO_READ_URL`, `KETO_WRITE_URL`, `MQTT_BROKER_URL`, `MQTT_TOPIC_PREFIX`, `WEBHOOK_SECRET`, `DADATA_API_KEY`, `CORS_ORIGIN`, `SMTP_URL`, `SMTP_REJECT_UNAUTHORIZED`, `MAIL_FROM`, `APP_BASE_URL` и блок `keeper` (`DATABASE_URL`, `HEALTH_PORT` и др.).

Альтернатива — корневой алиас: `npm run dev:server`.

### 5.3 Angular-клиент (нативно, hot-reload)

```bash
# Выполнять из: client/
cd client
npm ci --legacy-peer-deps
npm run start        # ng serve → :4200, прокси /api и /.ory → :3000
```

Открыть: `http://localhost:4200`. Прокси задан в `client/proxy.conf.json` (`/api` и `/.ory` → `http://localhost:3000`).

Альтернатива — корневой алиас: `npm run dev:client`.

### 5.4 Порядок запуска локальной разработки (краткая памятка)

1. Инфраструктура — **из корня**: `docker compose up -d`.
2. Сервер — **из `server/`**: `npm run dev`.
3. Клиент — **из `client/`**: `npm run start`.
4. Открыть `http://localhost:4200`.

> Зависимость: сервер и клиент требуют поднятой инфраструктуры (Kratos/Keto/MQTT), поэтому пункт 1 выполняется первым. Сервер и клиент между собой независимы и могут стартовать в любом порядке после инфраструктуры.

### 5.5 Телеметрия локально (keeper + схема)

```bash
# 1) Применить схему и поднять keeper (профиль telemetry) — из корня
docker compose --profile telemetry up -d telemetry-migrate keeper

# 2) Проверка хранителя
curl.exe http://localhost:3100/health
```

Keeper слушает `sensors/#` (префикс `industrial/` из `MQTT_TOPIC_PREFIX`), нормализует сообщения шлюза и пишет в таблицу `telemetry` (БД `telemetry` в контейнере `telemetry-kratos-db`).

Проверка данных:

```bash
docker exec telemetry-kratos-db psql -U kratos -d telemetry -c "SELECT count(*) FROM telemetry"
```

### 5.6 MQTT в локальной разработке

Mosquitto **входит** в dev-compose (порты 1883 и 9001). `server/.env` по умолчанию настроен на локальный брокер `MQTT_BROKER_URL=mqtt://localhost:1883`.

Проверка публикации/подписки:

```bash
docker exec telemetry-mosquitto mosquitto_sub -h 127.0.0.1 -t "industrial/sensors/#" -v
docker exec telemetry-mosquitto mosquitto_pub -h 127.0.0.1 -t "industrial/sensors/temp" -m "temperature=42.5"
```

### 5.7 Альтернатива: Express раздаёт собранный клиент

```bash
# Шаг 1 — сборка клиента (из client/)
cd client
npm run build        # результат: client/dist/browser

# Шаг 2 — запуск сервера (из server/)
cd ../server
npm run dev          # SERVE_CLIENT=true в server/.env
```

Открыть `http://localhost:3000`. Сервер раздаёт статику из `../client/dist/browser` (путь вычисляется от `server/`, поэтому `npm run dev` запускается именно из `server/`).

> Для этого режима в `server/.env` задайте `SERVE_CLIENT=true` (либо не задавайте вовсе — в dev-режиме по умолчанию `true`), а также `APP_BASE_URL=http://localhost:3000`, чтобы ссылка подтверждения в письме вела на правильный хост.

### 5.8 Остановка

```bash
docker compose down          # инфраструктура (данные БД сохраняются)
docker compose down -v       # с удалением данных БД
```

Dev-серверы (`npm run dev`, `npm run start`) останавливаются `Ctrl+C`.

### 5.9 Windows: фоновые dev-процессы и планировщик

На Windows длинный `npm run dev` / `npm run start`, запущенный «в лоб» через `Start-Process`, может быть убит вместе с завершением родительской оболочки (job object). Для долгоживущих dev-серверов используйте **Task Scheduler** — он отвязывает процессы от job-объекта:

```powershell
# подготовить launcher-скрипт (пример для сервера)
@'
Set-Location 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server'; npm.cmd run dev *> 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server-dev.log'
'@ | Out-File -Encoding utf8 $env:TEMP\it-run-server.ps1

schtasks /create /f /tn "it-dev-server" /sc once /st 00:00 `
  /tr "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $env:TEMP\it-run-server.ps1"
schtasks /run /tn "it-dev-server"
```

Аналогично для клиента (`it-dev-client`, каталог `...\client`, команда `npm.cmd run start`). Остановка:

```powershell
schtasks /end /tn it-dev-server;   schtasks /delete /tn it-dev-server /f
schtasks /end /tn it-dev-client;   schtasks /delete /tn it-dev-client /f
```

Docker-контейнеры при этом не затрагиваются — ими управляет Docker daemon. Подробнее — `user-data/DEV_STARTUP_NOTES.md`.

---

## 6. Управление секретами

Секреты **не хранятся в git**. В репозитории только шаблоны; реальные значения — в gitignored-файлах.

| Шаблон (tracked) | Реальный файл (gitignored) | Содержимое |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `WEBHOOK_SECRET`, `DADATA_API_KEY`, `SMTP_URI` (Kratos), `SMTP_URL`, `SMTP_REJECT_UNAUTHORIZED`, `MAIL_FROM`, `APP_BASE_URL` (сервер) |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | `secrets.cookie`, `secrets.cipher`, `web_hook.auth.config.value` (общий секрет webhook) |
| `kratos/kratos.docker.example.yml` | `kratos/kratos.docker.yml` | dev-конфиг, SMTP через `__SMTP_URI__` (подставляется compose) |
| `server/.env.example` | `server/.env` | локальные настройки dev-сервера: `SERVE_CLIENT`, Kratos/Keto, MQTT, `WEBHOOK_SECRET`, `SMTP_URL`/`MAIL_FROM`/`APP_BASE_URL`, `DADATA_API_KEY` |

> ⚠️ **Два разных SMTP-канала** — не путайте:
>
> - `SMTP_URI` — читает **Kratos** (courier), шлёт письма **восстановления пароля** (recovery). Задаётся в корневом `.env` (dev) / `.env.yc` (prod), подставляется в конфиг через `sed`.
> - `SMTP_URL` — читает **сервер** (nodemailer), шлёт письма **подтверждения регистрации**. Задаётся в `server/.env` (dev) / `.env.yc` (prod). Вместе с ним: `SMTP_REJECT_UNAUTHORIZED` (проверка TLS-сертификата), `MAIL_FROM` (адрес отправителя), `APP_BASE_URL` (хост, из которого строится ссылка подтверждения).

> ⚠️ Секрет webhook задаётся **одним и тем же значением** в двух местах: `WEBHOOK_SECRET` в `.env.yc` (для сервера) и `web_hook.auth.config.value` в `kratos/kratos.yc.yml` (для Kratos). Kratos **не подставляет `${VAR}`** — значение пишется напрямую, в заголовок `Authorization` (без `Bearer`). В dev по умолчанию `change-me-webhook-secret` — для чистого лога задайте то же значение в `server/.env` (`WEBHOOK_SECRET`).
>
> ⚠️ Kratos требует `secrets.cookie`/`secrets.cipher` **ровно 32 символа** (16 байт hex).

Генерация секретов (из любого каталога):

```bash
# cookie / cipher (ровно 32 hex-символа)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# WEBHOOK_SECRET (рекомендуется 64 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Локальные dev-конфиги Kratos: `kratos/kratos.docker.yml` (порт 4433, dev-compose) и `kratos/kratos.yml` (порт 4000, compose его не использует).

---

## 7. RBAC: роли и права

Роли: `admin`, `engineer`, `operator`, `viewer`. Хранятся в **Keto** (namespace `Role`, relation `member`), а не в `traits.role` Kratos. У пользователя может быть **несколько ролей**.

### 7.1 Целевая модель прав (по ресурсам)

| Ресурс | viewer | operator | engineer | admin |
|---|---|---|---|---|
| Dashboard | view | view | view + edit | полный |
| MQTT | view | view | view + edit | полный |
| MQTT Topics | view | view | view + edit | полный |
| Users | — | — | view | полный |
| Settings | — | — | view + edit | полный |

### 7.2 Что реально включено сейчас

- ✅ Роли из Keto **работают**: `kratosAuth` читает их через `ketoService.listRoles()`, `/api/session` отдаёт `roles`.
- ✅ Защита по ролям: `requireAdmin` закрывает `/api/users` (список и смену ролей) и `PUT /api/settings`.
- ⏳ Поресурсные права (`requirePermission`/`requireRole`/`loadPermissions`) **не задействованы**: `ketoService.seedDefaults()` не вызывается при старте, `requirePermission` не применён к маршрутам, маршрута `/api/permissions` нет. Таблица §7.1 — целевая модель; enforcement идёт по ролям. Задача `DEVELOPMENT_PLAN.md` (Фаза 3).

### 7.3 Назначение роли при регистрации

Новому пользователю автоматически назначается **`viewer`** двумя механизмами (оба идемпотентны, дубликаты исключены):

- **При подтверждении email** — `registerIdentity()` на сервере (в `GET /api/kratos/verify-email`) вызывает `ketoService.assignRole(identityId, Roles.VIEWER)` сразу после создания identity;
- **Kratos webhook** — `POST /api/webhooks/registration` (секрет `WEBHOOK_SECRET`), срабатывает по хуку после регистрации.

> Регистрация двухшаговая: сначала `POST /api/kratos/registration` сохраняет pending-запись и шлёт письмо, identity создаётся **только** после клика по ссылке `/api/kratos/verify-email?token=...`. Пароль валидируется на сервере (≥ 8 символов, ≤ 72, проверка по базе утечек HIBP).

### 7.4 Миграция существующих пользователей

Роли старых пользователей лежали в `traits.role`. Одноразовая миграция переносит их в Keto и чистит `traits.role`:

```bash
# Выполнять из: server/
npm run migrate:roles
```

### 7.5 Демо-пользователи презентации

```bash
# Выполнять из: server/
npm run seed:presentation
```

Создаёт (идемпотентно) `service@telemetry.ru` и `retail@telemetry.ru` с паролем `presentation` и ролью `viewer`. Им доступен маршрут `/presentation`.

---

## 8. Продакшен (Yandex Cloud)

Полное руководство — `user-data/DEPLOYMENT_GUIDE.md`. Ниже — самодостаточная последовательность «от нуля до работающего сайта», не требующая сторонней помощи.

### 8.0 Предпосылки

- Аккаунт Yandex Cloud и домен `industrial-telemetry.ru` (A-запись должна указывать на IP создаваемой ВМ).
- Публичный репозиторий: `https://github.com/mechtool/industrial-telemetry.git`.
- Локальный SSH-доступ к ВМ.

### 8.1 Создать ВМ

1. В консоли Yandex Cloud создайте ВМ **Ubuntu 24.04 LTS** (рекомендуется 2 vCPU / 4 GB RAM / 20 GB SSD).
2. В поле «cloud-init» вставьте содержимое `cloud-config.yaml` (создаёт пользователя `mit-2` с sudo и вашим SSH-ключом, ставит Docker + Compose v2 + Git + Node.js 22, настраивает swap 2 GB).
3. Откройте в Security Group порты **22 (SSH), 80, 443** (наружу нужны только 80/443 через nginx; 4433/4434/1883 закрыть).
4. Направьте A-запись `industrial-telemetry.ru` на публичный IP ВМ.

> ⚠️ Перед вставкой `cloud-config.yaml` замените `ssh_authorized_keys` на **свой** публичный ключ (в шаблоне — ключ автора).

### 8.2 Настроить SSH-доступ (локально)

В `~/.ssh/config`:

```
Host yc-vm
    HostName <IP-ВМ>
    User mit-2
    IdentityFile ~/.ssh/keys/yc-vm-key
    StrictHostKeyChecking no
```

Проверка: `ssh yc-vm "hostname && docker --version"`.

### 8.3 Клонировать и создать секреты

```bash
ssh yc-vm
cd ~
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry

cp .env.yc.example .env.yc
nano .env.yc

cp kratos/kratos.yc.example.yml kratos/kratos.yc.yml
nano kratos/kratos.yc.yml
```

В `.env.yc` заполнить (реальные значения вместо плейсхолдеров):

```ini
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=<пароль-БД>
MQTT_USERNAME=
MQTT_PASSWORD=
WEBHOOK_SECRET=<секрет-webhook>
DADATA_API_KEY=<ключ-DaData>

# Kratos: письма восстановления пароля
SMTP_URI=smtps://noreply%40industrial-telemetry.ru:<пароль-приложения>@smtp.yandex.ru:465/?skip_ssl_verify=false

# Сервер: письма подтверждения регистрации
SMTP_URL=smtps://noreply%40industrial-telemetry.ru:<пароль-приложения>@smtp.yandex.ru:465
SMTP_REJECT_UNAUTHORIZED=true
MAIL_FROM=noreply@industrial-telemetry.ru
APP_BASE_URL=https://industrial-telemetry.ru
```

В `kratos/kratos.yc.yml` заполнить `secrets.cookie`/`secrets.cipher` (по 32 hex) и `web_hook.auth.config.value` (= `WEBHOOK_SECRET`). SMTP в этот файл не пишется — он приходит через `SMTP_URI`.

> `.env.yc.example` уже содержит оба SMTP-канала (`SMTP_URI` для Kratos и `SMTP_URL`/`SMTP_REJECT_UNAUTHORIZED`/`MAIL_FROM`/`APP_BASE_URL` для сервера) и `DADATA_API_KEY`. Заполните все значения — без `SMTP_URL` письма подтверждения регистрации молча не уйдут (в логе `it-server` будет предупреждение).

Генерация секретов — см. §6.

### 8.4 Получить SSL-сертификат и собрать стек

Самый простой путь — готовый скрипт (сделает всё: заглушка сертификата → nginx → certbot webroot → перезагрузка nginx):

```bash
cd ~/industrial-telemetry
bash scripts/setup-https.sh
```

Либо вручную (см. §7 `DEPLOYMENT_GUIDE.md`): сначала самоподписанная заглушка в `/etc/letsencrypt/live/...`, затем `certbot certonly --webroot`.

### 8.5 Собрать и запустить

```bash
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

Порядок подъёма (определён `depends_on` + `healthcheck`):

1. `it-kratos-db` (PostgreSQL) → healthy;
2. `it-kratos-migrate` + `it-keto-migrate` (одноразовые миграции) → `Exited (0)`;
3. `it-kratos` + `it-keto`;
4. `it-mosquitto` + `it-server`;
5. `it-telemetry-migrate` → `it-keeper`;
6. `it-client` (nginx + Angular).

Проверить: `docker compose -f docker-compose.yc.yml --env-file .env.yc ps`.

### 8.6 Автообновление сертификатов (cron на ВМ)

```bash
# на ВМ: crontab -e (пользователь mit-2)
0 3,15 * * * /home/mit-2/industrial-telemetry/scripts/renew-cert.sh >> /home/mit-2/industrial-telemetry/renew-cert.log 2>&1
```

### 8.7 Проверка после деплоя

См. §10.1. Минимальный набор:

```bash
curl -s https://industrial-telemetry.ru/api/health      # healthy + mqtt:connected
curl -s https://industrial-telemetry.ru/.ory/health/alive
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/   # 200
```

### 8.8 Альтернатива: полностью автоматический деплой

`scripts/deploy-yc.sh` выполняет §8.3–§8.6 одной командой (установка Docker → клон → `.env.yc` → kratos-конфиг → HTTPS → build/up → cron). Запуск на свежей ВМ:

```bash
# на ВМ (после того, как A-запись указывает на IP)
cd ~ && git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry && chmod +x scripts/deploy-yc.sh && ./deploy-yc.sh
```

> Скрипт интерактивный: останавливается, чтобы вы отредактировали `.env.yc` и `kratos/kratos.yc.yml` перед сборкой.

---

## 9. Обновление / деплой

### 9.1 Локально (коммит и push)

```bash
git add -A
git commit -m "описание"
git push origin master
```

### 9.2 На ВМ (git pull + пересборка)

```bash
ssh yc-vm
cd ~/industrial-telemetry
git pull origin master

docker compose -f docker-compose.yc.yml --env-file .env.yc build client   # и/или server
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d client
```

Сопоставление «что пересобирать»:

- изменился Angular → `build client`;
- изменился сервер/keeper → `build server` (keeper использует тот же контекст);
- изменились конфиги Kratos/Keto/Mosquitto → `up -d <сервис>` (конфиги — volume). Kratos не перечитывает конфиг на лету, но `up -d kratos` пересоздаёт контейнер.

> 💡 Корневые алиасы `docker:yc:up` / `docker:yc:build` сначала выполняют `npm run build:client` (локальная сборка Angular), хотя Dockerfile собирает Angular внутри контейнера — локальная сборка избыточна. Для деплоя надёжнее вызывать `docker compose -f docker-compose.yc.yml ...` напрямую из корня.

---

## 10. Проверка работоспособности

### 10.1 Prod (на ВМ)

```bash
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy","uptime":...,"mqtt":"connected"}}

curl -s https://industrial-telemetry.ru/.ory/health/alive   # → {"status":"ok"}

# Keeper (телеметрия)
ssh yc-vm "curl -s http://localhost:3100/health"            # или docker exec it-keeper ...
ssh yc-vm "docker exec it-kratos-db psql -U kratos -d telemetry -c 'SELECT count(*) FROM telemetry'"
```

> Защищённые эндпоинты (`/api/session`, `/api/projects`, `/api/users`, `/api/settings`) требуют сессионной cookie — проверять в браузере после логина.

Чек-лист (браузер):

- [ ] `/` отдаёт 200, главная «CRYOMON» рендерится;
- [ ] `/api/health` → `status: healthy`, `mqtt: connected`;
- [ ] `/.ory/health/alive` → `{"status":"ok"}`;
- [ ] регистрация: форма → экран «Проверьте почту» → письмо приходит (SMTP_URL) → клик по ссылке → редирект в приложение;
- [ ] у нового пользователя в Keto роль `viewer` (под админом `/api/users`, либо relation-tuples в `it-keto`);
- [ ] логин созданным аккаунтом → главная «CRYOMON»;
- [ ] список проектов (`/api/projects`) отдаёт стартовые проекты;
- [ ] под админом: список пользователей (`/api/users`) и смена ролей работают;
- [ ] под админом: настройки (`/api/settings`) читаются и сохраняются;
- [ ] recovery: письмо восстановления приходит (SMTP_URI), смена пароля работает;
- [ ] logout → редирект на логин;
- [ ] `it-keeper` в статусе Up, `:3100/health` → `mqtt: connected`, `database: ok`;
- [ ] в логах `it-kratos` webhook `Dispatching webhook` без `webhook failed`.

### 10.2 Dev (локально)

```bash
docker compose ps
curl.exe http://localhost:3000/api/health
curl.exe http://localhost:4433/health/alive
curl.exe http://localhost:4466/health/ready
curl.exe http://localhost:3100/health   # если поднят keeper
```

---

## 11. Устранение неполадок

| Симптом | Причина | Решение |
|---|---|---|
| `ENOTFOUND mosquitto` / `Warn Provider stream connection dropped` | MQTT-брокер недоступен | проверить `MQTT_BROKER_URL` в `server/.env`; в dev поднять `docker compose up -d mosquitto`; не критично |
| `docker compose up -d` → «no configuration file provided» | команда не из корня | `cd` в корень (`docker-compose.yml` там) |
| `kratos` падает с «open ... kratos.docker.yml: no such file» | dev-конфиг Kratos не создан | `cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml` |
| `npm run dev` → «Missing script: dev» | команда из корня, а не из `server/` | `cd server` или `npm run dev:server` |
| `npm run start` → «Missing script: start» | команда не из `client/` | `cd client` или `npm run dev:client` |
| Сервер с `SERVE_CLIENT=true` отдаёт 404 на главной | запущен не из `server/` | запускать `npm run dev` строго из `server/` |
| `npm ci` падает на peer-зависимостях (клиент) | Angular 22 + NG-ZORRO | использовать `npm ci --legacy-peer-deps` |
| `nginx 502 Bad Gateway` на `/api` | контейнер `it-server` упал | `docker logs it-server` |
| Kratos `secrets.cipher length must be >= 32` | секрет не ровно 32 символа | сгенерировать `randomBytes(16).toString('hex')` |
| Kratos `does not match pattern "^smtps?://"` | `SMTP_URI` пуст/неверен | прописать реальный `smtps://...` в env |
| Webhook 401 / роль `viewer` не назначается | `WEBHOOK_SECRET` не совпадает с `web_hook.auth.config.value` | прописать одно значение, перезапустить `server` и `kratos` |
| Письмо подтверждения регистрации не уходит | не задан `SMTP_URL` (сервер) или `SMTP_URI` (Kratos) | задать нужный канал: регистрация → `SMTP_URL`; восстановление → `SMTP_URI`; в dev смотреть письма в MailSlurper `:4436` |
| Ссылка подтверждения ведёт на неверный хост | `APP_BASE_URL` не совпадает с адресом приложения | задать `APP_BASE_URL` (`http://localhost:3000` в dev, `https://<домен>` в prod) |
| Keto `version ... does not match` | `keto/keto.yml` объявлял `v0.14.0-alpha.0`, образ `v0.14.0` | исправлено: `version` в `keto/keto.yml` = `v0.14.0` |
| Keeper не пишет строки | таблица `telemetry` не создана / неверный `DATABASE_URL` | применить `scripts/telemetry-schema.sql` (или `docker compose --profile telemetry up -d telemetry-migrate`), проверить `:3100/health` |
| `git pull` на ВМ падает с «could not read Username» | нет креденшелов | репозиторий публичный; при необходимости добавить креденшелы |
| После force-push локальный клон разошёлся | история переписана | `git fetch origin && git reset --hard origin/master` |
| Dev-сервер/клиент умирают при закрытии терминала (Windows) | job object убивает дочерние процессы | запускать через Task Scheduler (§5.9) |

Просмотр логов:

```bash
# Prod — на ВМ
docker compose -f docker-compose.yc.yml --env-file .env.yc logs -f

# Dev — из корня
docker compose logs -f
docker compose --profile telemetry logs -f keeper
```

---

## 12. Шпаргалка команд

```bash
# ============ ЛОКАЛЬНО ============
git clone https://github.com/mechtool/industrial-telemetry.git
npm run install:all                                # зависимости (корень)
cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml   # dev-конфиг Kratos (первый запуск)
docker compose up -d                               # dev-инфраструктура (корень)
cd server && npm run dev                           # Express :3000
cd client && npm run start                         # Angular :4200
cd server && npm run build                         # сборка сервера
cd client && npm run build                         # сборка клиента

# Телеметрия (корень)
docker compose --profile telemetry up -d telemetry-migrate keeper
curl.exe http://localhost:3100/health

# Миграция ролей traits.role -> Keto (одноразовая, старые инсталляции)
cd server && npm run migrate:roles

# Демо-пользователи презентации
cd server && npm run seed:presentation

docker compose down                                # остановка (данные сохраняются)
docker compose down -v                             # остановка + удаление БД

# ============ ПРОД (НА ВМ) ============
ssh yc-vm
cd ~/industrial-telemetry
git pull origin master
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
docker compose -f docker-compose.yc.yml --env-file .env.yc build client server
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
docker compose -f docker-compose.yc.yml --env-file .env.yc logs -f

# HTTPS / автообновление — один раз при развёртывании:
#   bash scripts/setup-https.sh
#   crontab -e → 0 3,15 * * * /home/mit-2/industrial-telemetry/scripts/renew-cert.sh >> /home/mit-2/industrial-telemetry/renew-cert.log 2>&1
```

### Итоговая таблица «что откуда запускать»

| Команда | Каталог запуска |
|---|---|
| `docker compose up -d` / `down` / `ps` / `logs` (dev) | **корень проекта** |
| `docker compose -f docker-compose.yc.yml --env-file .env.yc ...` (prod) | **корень проекта** (на ВМ — `~/industrial-telemetry`) |
| `npm run install:all`, `dev:server`, `dev:client`, `build:server`, `build:client`, `keeper:*`, `telemetry:*`, `docker:yc:*` | **корень проекта** |
| `npm ci`, `npm run dev`, `build`, `start`, `keeper:dev`, `keeper:start`, `migrate:roles`, `seed:presentation` | **`server/`** |
| `npm ci --legacy-peer-deps`, `npm run start`, `build`, `watch`, `test` | **`client/`** |
| `git add` / `commit` / `push` / `pull` | любой каталог репозитория |
| `ssh yc-vm`, `node -e ...`, `curl`/`curl.exe`, `docker exec` | любой каталог |
