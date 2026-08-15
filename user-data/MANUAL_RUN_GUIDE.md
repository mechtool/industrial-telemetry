# Industrial Telemetry — Руководство по запуску

**Версия:** 3.0
**Дата:** 2026-08-07
**Стек:** Angular 22 (PWA) + Express + MQTT (Mosquitto) + Ory Kratos + Ory Keto (RBAC) + PostgreSQL + Nginx

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Предварительные требования](#2-предварительные-требования)
3. [Режим разработки и отладки](#3-режим-разработки-и-отладки)
   - [3.1 Вариант A: Полный Docker-стек (быстрый старт)](#31-вариант-a-полный-docker-стек-быстрый-старт)
   - [3.2 Вариант B: Гибридный (hot-reload для отладки)](#32-вариант-b-гибридный-hot-reload-для-отладки)
4. [Режим продакшен (Yandex Cloud)](#4-режим-продакшен-yandex-cloud)
   - [4.1 Подготовка ВМ](#41-подготовка-вм)
   - [4.2 Деплой приложения](#42-деплой-приложения)
   - [4.3 Настройка HTTPS](#43-настройка-https)
   - [4.4 Настройка RBAC](#44-настройка-rbac)
   - [4.5 Обновление приложения](#45-обновление-приложения)
5. [Проверка работоспособности](#5-проверка-работоспособности)
6. [Устранение неполадок](#6-устранение-неполадок)
7. [Обслуживание и эксплуатация](#7-обслуживание-и-эксплуатация)
8. [Шпаргалка команд](#8-шпаргалка-команд)

---

## 1. Архитектура

```
                         Браузер пользователя
                  http://localhost:4200  (dev, hot-reload)
                  http://localhost:3000  (dev, Express раздаёт статику)
                  https://industrial-telemetry.ru  (prod)

                               │
          ┌────────────────────┼─────────────────────┐
          ▼                    ▼                     ▼
   ┌─────────────┐     ┌─────────────┐       ┌───────────────┐
   │   Nginx     │     │  Express    │       │ Angular CLI   │
   │   :80/:443  │◄───►│  API :3000  │       │ :4200         │
   │   прокси    │     │             │       │ (dev server   │
   │   + статика │     │ ┌─────────┐ │       │  + proxy)     │
   └──────┬──────┘     │ │Keto     │ │       └───────────────┘
          │            │ │клиент   │ │
          │            │ └────┬────┘ │
          │            │      │      │
          │            │ ┌────┴────┐ │
          │            │ │  MQTT   │ │
          │            │ │  мост   │ │
          │            │ └────┬────┘ │
          │            │      │      │
          │            │      │      │
          └──────┬─────┘      │      │
                 │            │      │
        ┌────────▼──────┐     │      │
        │ /.ory → Kratos│     │      │
        │     :4433     │     │      │
        └───────┬───────┘     │      │
                │             │      │
                ▼             ▼      ▼
        ┌───────────────────────────────┐
        │       PostgreSQL :5432        │
        │    БД: kratos, keto           │
        └───────────────────────────────┘
                ▲
                │
        ┌───────┴───────┐
        │    Mosquitto  │
        │    :1883      │
        │  (MQTT брокер)│
        └───────────────┘
```

### Компоненты

| Сервис | Назначение | Порты | Образ / Технология |
|---|---|---|---|
| **PostgreSQL 16** | База данных (Kratos + Keto) | 5432 | `postgres:16-alpine` |
| **Kratos Migrate** | Миграция схемы Kratos (одноразово) | — | `oryd/kratos:v1.3.1` |
| **Ory Kratos** | Identity Provider (регистрация, логин, восстановление) | 4433 (public), 4434 (admin) | `oryd/kratos:v1.3.1` |
| **Keto Migrate** | Миграция схемы Keto (одноразово) | — | `oryd/keto:v0.14.0-alpha.0` |
| **Ory Keto** | Permission Server (RBAC: admin/engineer/operator) | 4466 (read), 4467 (write) | `oryd/keto:v0.14.0-alpha.0` |
| **Mosquitto** | MQTT-брокер (телеметрия) | 1883 (MQTT), 9001 (WebSocket) | `eclipse-mosquitto:2` |
| **Express Server** | API-сервер (health, прокси Kratos, Keto-клиент, MQTT-мост) | 3000 | Node.js 22 + TypeScript |
| **Nginx + Angular** | Обратный прокси + раздача PWA-статики | 80, 443 | `nginx:1.27-alpine` + Angular 22 |

### Порядок запуска

```
1. PostgreSQL (kratos-db)
2. Kratos Migrate + Keto Migrate (параллельно, после готовности БД)
3. Mosquitto MQTT
4. Ory Kratos + Ory Keto (параллельно, после миграций)
5. Express Server (после Kratos + Keto + Mosquitto)
6. Nginx (после Express Server + Kratos)
```

### Ролевая модель RBAC (Keto)

| Ресурс | operator | engineer | admin |
|---|---|---|---|
| Dashboard | просмотр | просмотр + edit | полный доступ |
| MQTT | просмотр | просмотр + edit | полный доступ |
| MQTT Topics | просмотр | просмотр + edit | полный доступ |
| Users | — | просмотр | полный доступ |
| Settings | — | просмотр + edit | полный доступ |

---

## 2. Предварительные требования

| Инструмент | Мин. версия | Проверка | Примечание |
|---|---|---|---|
| **Node.js** | ≥ 22 LTS | `node --version` | Требуется для сборки клиента и сервера |
| **npm** | ≥ 10 | `npm --version` | Идёт в комплекте с Node.js 22 |
| **Docker** | ≥ 27 | `docker --version` | Только для Docker-варианта запуска |
| **Docker Compose** | v2 (плагин) | `docker compose version` | Команда `docker compose` (не `docker-compose`) |
| **Git** | ≥ 2.40 | `git --version` | Для клонирования и обновления |
| **Angular CLI** | 22 | `npx ng version` | Устанавливается локально через `npm ci` |

### Установка на локальной машине (Windows / macOS / Linux)

**Docker Desktop** (Windows / macOS):
- Скачать с [docker.com](https://www.docker.com/products/docker-desktop/)
- Установить, запустить, дождаться статуса «Engine running»

**Docker Engine** (Linux):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Выйти из сессии и зайти заново
```

**Node.js 22**:
```bash
# Windows / macOS: скачать с https://nodejs.org/ (LTS)
# Linux (Ubuntu/Debian):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Клонирование репозитория

```bash
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

---

## 3. Режим разработки и отладки

### 3.1 Вариант A: Полный Docker-стек (быстрый старт)

**Все сервисы работают внутри Docker-контейнеров.** Самый простой способ поднять всё одной командой. Подходит для демонстрации, приёмочного тестирования и когда не нужно менять код.

#### Шаг 1: Сборка клиента

Клиент (Angular) нужно собрать локально перед запуском Docker-стека.

```bash
cd client
npm ci --legacy-peer-deps
npm run build
cd ..
```

Флаг `--legacy-peer-deps` обязателен из-за частичной несовместимости peer-зависимостей Angular 22 с PrimeNG 21.

#### Шаг 2: Запуск всех сервисов

```bash
docker compose up -d
```

Docker Compose последовательно запустит:
1. `telemetry-kratos-db` — PostgreSQL
2. `telemetry-kratos-migrate` — миграция схемы Kratos (завершится и выйдет)
3. `telemetry-keto-migrate` — миграция схемы Keto (завершится и выйдет)
4. `telemetry-kratos` — Ory Kratos (после миграции)
5. `telemetry-keto` — Ory Keto (после миграции)

Express-сервер и Nginx **не входят** в dev-стек `docker-compose.yml` — они запускаются отдельно (см. варианты ниже).

#### Шаг 3: Запуск Express-сервера (в отдельном терминале)

```bash
cd server
npm ci
npm run dev
```

Сервер запустится на `http://localhost:3000` в режиме `tsx watch` (автоперезагрузка при изменениях).

#### Шаг 4: Запуск клиента (в ещё одном терминале)

```bash
cd client
npm run start
```

Angular dev-сервер запустится на `http://localhost:4200` с проксированием `/api` и `/.ory` на Express Server (порт 3000), как настроено в `client/proxy.conf.json`.

#### Проверка

```bash
# Статус контейнеров
docker compose ps
# Ожидаемый результат: 3 контейнера Up (kratos-db, kratos, keto), 2 Exited (0) (миграции)

# Express
curl http://localhost:3000/api/health
# → {"success":true,"data":{"status":"healthy","uptime":...,"mqtt":"connected"}}

# Kratos
curl http://localhost:4433/health/alive
# → {"status":"ok"}

# Keto
curl http://localhost:4466/health/ready
# → {"status":"ok"}

# Angular (открыть в браузере)
# http://localhost:4200
```

#### Остановка

```bash
# Остановить контейнеры (данные БД сохраняются)
docker compose down

# Остановить и удалить все данные (чистый старт в следующий раз)
docker compose down -v

# Остановить dev-серверы: Ctrl+C в каждом терминале
```

---

### 3.2 Вариант B: Гибридный (hot-reload для отладки)

**Docker — только инфраструктура** (PostgreSQL, Kratos, Keto, Mosquitto). **Express и Angular — нативно** с hot-reload. Идеально для активной разработки: изменения в коде подхватываются мгновенно, брейкпойнты в IDE работают.

#### Шаг 1: Поднять только инфраструктуру

```bash
docker compose up -d kratos-db kratos-migrate kratos keto-migrate keto
```

Или с Mosquitto, если нужен MQTT:

```bash
docker compose up -d
```

#### Шаг 2: Настроить `.env` для сервера

Файл `server/.env` (уже существует в репозитории, проверьте):

```env
NODE_ENV=development
PORT=3000
SERVE_CLIENT=true
KRATOS_PUBLIC_URL=http://localhost:4433
KETO_READ_URL=http://localhost:4466
KETO_WRITE_URL=http://localhost:4467
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=industrial-telemetry-dev
MQTT_TOPIC_PREFIX=industrial/
CORS_ORIGIN=http://localhost:4200,http://localhost:3000
```

**Важно:** при запуске Express **вне Docker** URL Kratos/Keto — `localhost`, а не имена контейнеров (`kratos`, `keto`). Это потому, что порты контейнеров проброшены на хост через `ports:` в docker-compose.yml.

#### Шаг 3: Запуск Express-сервера (терминал 1)

```bash
cd server
npm ci
npm run dev
```

`npm run dev` запускает `tsx watch src/index.ts` — сервер автоматически перезагружается при каждом сохранении `.ts`-файла.

Лог при успешном старте:
```
[Server] Industrial Telemetry API запущен на http://localhost:3000
[Server] Kratos public: http://localhost:4433
```

#### Шаг 4: Запуск Angular dev-сервера (терминал 2)

```bash
cd client
npm ci --legacy-peer-deps
npm run start
```

Angular CLI запустит dev-сервер на `http://localhost:4200`. Прокси (`proxy.conf.json`) направляет `/api` и `/.ory` на Express (порт 3000), который в свою очередь проксирует `/.ory` на Kratos (порт 4433).

Hot Module Replacement (HMR) работает: изменения в `.ts`, `.html`, `.scss` применяются в браузере без перезагрузки страницы.

#### Шаг 5: Открыть в браузере

```
http://localhost:4200
```

Что происходит при открытии страницы:
1. Angular загружает SPA
2. Запросы к `/api/*` проксируются Angular CLI → Express :3000
3. Запросы к `/.ory/*` проксируются Angular CLI → Express :3000 → Kratos :4433
4. Express проверяет сессию через Kratos Admin API
5. Express проверяет права через Keto API (порты 4466/4467)

#### Альтернатива: Express раздаёт статику (без Angular CLI)

Если `SERVE_CLIENT=true` и клиент собран:

```bash
cd client && npm run build && cd ..
cd server && npm run dev
```

Открыть: `http://localhost:3000`. Express сам раздаст собранную статику из `client/dist/browser/`.

#### Отладка в IDE (WebStorm / VS Code)

**Express (server):**
- Открыть `server/src/index.ts`
- Поставить брейкпойнт
- Запустить конфигурацию Node.js: `tsx src/index.ts`
- Или в терминале: `cd server && npx tsx --inspect src/index.ts`

**Angular (client):**
- Установить расширение Angular DevTools в браузере
- Использовать `ng serve` с source maps (включены по умолчанию в development-конфигурации)
- В WebStorm: Run → Edit Configurations → npm → `start` (из `client/`)

---

## 4. Режим продакшен (Yandex Cloud)

Целевая ВМ: Ubuntu 24.04 LTS, 2 vCPU, 4 GB RAM, 20 GB SSD. Домен: `industrial-telemetry.ru`.

### 4.1 Подготовка ВМ

#### Вариант A: Автоматическая настройка через cloud-init

При создании ВМ в Yandex Cloud вставить содержимое файла `cloud-config.yaml` в поле «cloud-init». Это автоматически:
- Создаст пользователя `mit-2` с sudo без пароля
- Установит Docker, Git, Node.js 22
- Настроит swap 2 GB

#### Вариант B: Ручная настройка

```bash
ssh -i <путь_к_ключу> mit-2@<IP_ВМ>
```

**Системные пакеты:**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release
```

**Docker и Docker Compose:**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# Выйти из SSH и зайти заново для применения группы docker
```

**Node.js 22:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Swap (рекомендовано для ВМ с 4 GB RAM):**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4.2 Деплой приложения

#### Шаг 1: Клонирование и сборка

```bash
cd ~
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry

# Сборка клиента
cd client && npm ci --legacy-peer-deps && npm run build && cd ..

# Сборка сервера
cd server && npm ci && npm run build && cd ..
```

#### Шаг 2: Конфигурация `.env.yc`

Создать/отредактировать `~/industrial-telemetry/.env.yc`:

```ini
APP_URL=https://industrial-telemetry.ru
CORS_ORIGIN=https://industrial-telemetry.ru
MQTT_USERNAME=
MQTT_PASSWORD=
DB_PASSWORD=<надёжный_пароль_для_postgres>
```

Если домен ещё не привязан — использовать IP-адрес ВМ вместо домена (временно, до настройки HTTPS).

#### Шаг 3: Конфигурация Kratos (production)

Файл `kratos/kratos.yc.yml` уже настроен на домен `industrial-telemetry.ru`. Если домен другой — заменить во всех URL (14 вхождений: `base_url`, `allowed_return_urls`, все `ui_url`).

**Обязательно сменить секреты** на уникальные:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # выполнить 2 раза
```

Заменить `secrets.cookie` и `secrets.cipher` в `kratos/kratos.yc.yml` на сгенерированные значения.

Секреты задаются переменными окружения в `.env.yc` (`KRATOS_COOKIE_SECRET`, `KRATOS_CIPHER_SECRET`, `SMTP_URI`, `DB_PASSWORD`), а не хранятся в конфиге.

#### Шаг 4: Сборка Docker-образов и запуск

```bash
cd ~/industrial-telemetry

# Собрать все образы заново
docker compose -f docker-compose.yc.yml --env-file .env.yc build --no-cache

# Запустить стек
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

Порядок запуска (автоматический, через `depends_on`):
1. `it-kratos-db` — PostgreSQL
2. `it-kratos-migrate` + `it-keto-migrate` — миграции (параллельно)
3. `it-mosquitto` — MQTT-брокер
4. `it-kratos` + `it-keto` — Identity + Permissions (параллельно)
5. `it-server` — Express API
6. `it-client` — Nginx + Angular PWA

#### Шаг 5: Проверка статуса

```bash
docker compose -f docker-compose.yc.yml ps
```

Ожидаемый вывод: 6 контейнеров в статусе `Up`, 2 контейнера `Exited (0)` (миграции).

```bash
# Проверка API (внутри ВМ)
curl -s http://localhost:3000/api/health
# → {"success":true,"data":{"status":"healthy",...}}

# Проверка через Nginx
curl -s http://localhost:80/api/health
# → {"success":true,"data":{"status":"healthy",...}}
```

### 4.3 Настройка HTTPS

#### Шаг 1: Открыть порты в Security Group Yandex Cloud

```bash
# Получить ID security group
yc vpc security-group list

# Открыть порты 80 (HTTP) и 443 (HTTPS)
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=80,protocol=tcp,v4-cidrs=0.0.0.0/0
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=443,protocol=tcp,v4-cidrs=0.0.0.0/0
```

#### Шаг 2: Привязать домен

В панели регистратора домена создать A-запись: `industrial-telemetry.ru` → внешний IP ВМ.

Проверить:
```bash
nslookup industrial-telemetry.ru
# Должен показать IP ВМ
```

#### Шаг 3: Получить SSL-сертификат

Автоматический способ — скрипт `scripts/setup-https.sh`:

```bash
cd ~/industrial-telemetry
bash scripts/setup-https.sh
```

Скрипт последовательно:
1. Создаёт самоподписанный сертификат-заглушку (чтобы Nginx мог стартовать)
2. Запускает Nginx
3. Запрашивает сертификат Let's Encrypt через webroot-челлендж
4. Перезагружает Nginx с настоящим сертификатом

Ручной способ:
```bash
# Установить certbot
sudo apt install -y certbot

# Выпустить сертификат
sudo certbot certonly --webroot -w /var/www/certbot \
  -d industrial-telemetry.ru \
  --email mit-2@yandex.ru --agree-tos --non-interactive

# Проверить автообновление
sudo certbot renew --dry-run
```

Сертификаты монтируются в контейнер `it-client` через volume `/etc/letsencrypt:/etc/letsencrypt:ro`.

Контейнер `certbot` (профиль `ssl` в docker-compose.yc.yml) обновляет сертификаты каждые 12 часов автоматически. Запускается так:

```bash
docker compose -f docker-compose.yc.yml --profile ssl up -d certbot
```

### 4.4 Настройка RBAC

Keto автоматически инициализирует роли и разрешения при первом старте сервера (seed из `server/src/services/keto.service.ts`).

Пользователю при регистрации присваивается роль `operator` по умолчанию (поле `role` в traits identity Kratos).

#### Назначение роли через API

```bash
# Назначить роль admin пользователю с ID <user-uuid>
curl -X PUT http://localhost:4467/admin/relation-tuples \
  -H 'Content-Type: application/json' \
  -d '{
    "namespace": "Role",
    "object": "admin",
    "relation": "member",
    "subject_id": "<user-uuid>"
  }'
```

ID пользователя (UUID) можно получить через Kratos Admin API:
```bash
curl -s http://localhost:4434/admin/identities | jq '.[].id'
```

### 4.5 Обновление приложения

```bash
cd ~/industrial-telemetry

# Получить последние изменения
git pull

# Пересобрать клиент и сервер
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
cd server && npm ci && npm run build && cd ..

# Пересобрать Docker-образы и перезапустить
docker compose -f docker-compose.yc.yml build --no-cache
docker compose -f docker-compose.yc.yml up -d
```

После обновления проверить статус:
```bash
docker compose -f docker-compose.yc.yml ps
curl -s https://industrial-telemetry.ru/api/health
```

---

## 5. Проверка работоспособности

### Health-check эндпоинты

| Endpoint | Ожидаемый ответ | Что проверяет |
|---|---|---|
| `GET /api/health` | `{"success":true,"data":{"status":"healthy","mqtt":"connected"}}` | Express + MQTT |
| `GET /api/permissions` | `{"success":true,"data":{"canViewDashboard":true,...}}` | Keto RBAC (требуется сессия) |
| `GET /api/session` | `{"success":true,"data":{"id":"...","email":"...","role":"operator"}}` | Kratos сессия |
| `/.ory/health/alive` | `{"status":"ok"}` | Kratos |
| `/.ory/health/ready` | `{"status":"ok"}` | Kratos + PostgreSQL |
| `GET /` | Angular PWA (index.html) | Статика |

### End-to-end проверка

1. Открыть приложение в браузере
2. Страница регистрации: ввести email, username, пароль
3. После регистрации — автоматический логин и редирект на `/dashboard`
4. Проверить консоль браузера: `GET /api/permissions` возвращает права текущей роли
5. На дашборде отображается статус MQTT (подключён/отключён)
6. **Recovery flow:** нажать «Забыли пароль?» → ввести email → получить письмо → перейти по ссылке → задать новый пароль
7. Logout → редирект на `/login`

### Команды для проверки из терминала

```bash
# Локальная разработка
curl -s http://localhost:3000/api/health | jq
curl -s http://localhost:4433/health/alive | jq
curl -s http://localhost:4466/health/ready | jq

# Продакшен (после входа и получения cookie)
curl -s https://industrial-telemetry.ru/api/health | jq
curl -s -H 'Cookie: ory_kratos_session=...' https://industrial-telemetry.ru/api/permissions | jq
```

---

## 6. Устранение неполадок

### Проблемы запуска

| Симптом | Вероятная причина | Диагностика | Решение |
|---|---|---|---|
| Контейнеры не стартуют | Docker не запущен или порты заняты | `docker info`, `netstat -an \| grep 5432` | Запустить Docker, освободить порты |
| `kratos-migrate` падает | PostgreSQL не готов | `docker logs telemetry-kratos-migrate` | Подождать, пока `kratos-db` станет healthy |
| `kratos` стартует и падает | Ошибка в конфигурации | `docker logs telemetry-kratos` | Проверить `kratos/kratos.docker.yml`, особенно `dsn` и секреты |
| `keto` не стартует | Миграция не прошла | `docker logs telemetry-keto`, `docker logs telemetry-keto-migrate` | Запустить миграцию вручную: `docker compose up keto-migrate` |
| Express: `ECONNREFUSED :4433` | Kratos не запущен | `curl http://localhost:4433/health/alive` | Убедиться, что Kratos в статусе `Up` |
| Express: `ECONNREFUSED :4466` | Keto не запущен | `curl http://localhost:4466/health/ready` | Убедиться, что Keto в статусе `Up` |

### Проблемы в рантайме

| Симптом | Вероятная причина | Диагностика | Решение |
|---|---|---|---|
| **502 Bad Gateway** | Express-сервер не отвечает | `docker logs it-server` | Kratos/Keto недоступны — проверить статус контейнеров |
| **504 Gateway Timeout** | Keto recovery fetch завис | `docker logs it-server` | Перезапустить сервер: `docker compose restart server` |
| **401 Unauthorized** | Сессия истекла или cookie отсутствует | DevTools → Application → Cookies | Перелогиниться |
| **403 Forbidden** | У пользователя нет прав на операцию | `GET /api/permissions` | Проверить роль через Keto API, при необходимости повысить |
| **Nginx 404** | Статика не собрана или путь неверный | `docker logs it-client` | Пересобрать клиент: `cd client && npm run build` |
| **MQTT не подключается** | Mosquitto не запущен или неверный URL | `docker logs it-mosquitto` | Проверить порт 1883, переменную `MQTT_BROKER_URL` |
| **CORS-ошибка в браузере** | Неверный `CORS_ORIGIN` | DevTools → Console | Проверить `CORS_ORIGIN` в `.env`, должен совпадать с `Origin` запроса |
| **«Cookies are not supported»** | Сессионная кука не сохраняется | `docker logs it-kratos` | Убедиться, что `base_url` в конфиге Kratos использует тот же протокол и домен, что и фронтенд |

### Частые ошибки при разработке

| Ошибка | Причина | Решение |
|---|---|---|
| `npm ci` падает с peer dependency conflict | Несовместимость версий PrimeNG 21 и Angular 22 | Использовать `npm ci --legacy-peer-deps` |
| `tsx` не найден | Зависимости не установлены | `cd server && npm ci` |
| `ng` не найден | Angular CLI не установлен глобально | Использовать `npx ng ...` или установить глобально: `npm i -g @angular/cli@22` |
| Изменения в Angular не применяются | Кеш браузера или сборки | Жёсткая перезагрузка: Ctrl+Shift+R, или `ng serve` с `--live-reload` |
| Port 4200 already in use | Другой процесс на порту 4200 | `npx kill-port 4200` или `--port 4300` |
| Port 3000 already in use | Другой процесс на порту 3000 | `npx kill-port 3000` или сменить `PORT` в `server/.env` |

---

## 7. Обслуживание и эксплуатация

### Мониторинг состояния

```bash
# Список контейнеров с состоянием
docker compose -f docker-compose.yc.yml ps

# Потребление ресурсов
docker stats --no-stream

# Занятость диска
df -h /
```

### Бэкап базы данных

```bash
# Бэкап Kratos (пользователи, сессии)
docker exec it-kratos-db pg_dump -U kratos kratos > kratos-backup-$(date +%Y%m%d).sql

# Бэкап Keto (роли, разрешения)
docker exec it-kratos-db pg_dump -U kratos keto > keto-backup-$(date +%Y%m%d).sql

# Архивировать
tar -czf telemetry-backup-$(date +%Y%m%d).tar.gz *.sql
```

**Восстановление:**
```bash
docker exec -i it-kratos-db psql -U kratos kratos < kratos-backup-YYYYMMDD.sql
docker exec -i it-kratos-db psql -U kratos keto < keto-backup-YYYYMMDD.sql
```

### Просмотр логов

```bash
# Все логи (tail)
docker compose -f docker-compose.yc.yml logs --tail=50

# Логи конкретного сервиса (live)
docker compose -f docker-compose.yc.yml logs -f server
docker compose -f docker-compose.yc.yml logs -f kratos

# Логи за последние 30 минут
docker logs --since 30m it-server
```

### Перезапуск отдельных сервисов

```bash
# Только Express-сервер
docker compose -f docker-compose.yc.yml restart server

# Только Nginx
docker compose -f docker-compose.yc.yml restart client

# Kratos (сессии пользователей сохранятся в БД)
docker compose -f docker-compose.yc.yml restart kratos
```

---

## 8. Шпаргалка команд

### NPM-скрипты (из корня проекта)

```bash
npm run install:all       # Установка зависимостей server + client
npm run dev:server        # Запуск Express в dev-режиме (tsx watch)
npm run dev:client        # Запуск Angular dev-сервера (4200)
npm run build:server      # Компиляция TypeScript → JavaScript
npm run build:client      # Сборка Angular (production)
npm run docker:up         # Поднять dev Docker-стек
npm run docker:down       # Остановить dev Docker-стек
npm run docker:logs       # Логи dev Docker-стека
npm run docker:yc:up      # Поднять production-стек (Yandex Cloud)
npm run docker:yc:down    # Остановить production-стек
npm run docker:yc:build   # Пересобрать production-образы
npm run docker:yc:logs    # Логи production-стека
```

### Docker — локальная разработка

```bash
docker compose ps                                  # Статус всех контейнеров
docker compose up -d                               # Запустить все сервисы
docker compose down                                # Остановить (данные сохраняются)
docker compose down -v                             # Остановить и удалить все данные
docker compose restart kratos                      # Перезапустить Kratos
docker compose logs kratos --tail=50               # Логи Kratos
docker compose logs -f server                      # Логи Express (live)
docker exec -it telemetry-kratos-db psql -U kratos # Подключиться к БД
```

### Docker — продакшен (Yandex Cloud)

```bash
# Все команды — из корня проекта на ВМ
docker compose -f docker-compose.yc.yml ps
docker compose -f docker-compose.yc.yml logs --tail=50
docker compose -f docker-compose.yc.yml logs -f server
docker compose -f docker-compose.yc.yml restart server
docker compose -f docker-compose.yc.yml down          # Остановить
docker compose -f docker-compose.yc.yml down -v       # Остановить + удалить все данные
docker compose -f docker-compose.yc.yml build --no-cache  # Полная пересборка
docker compose -f docker-compose.yc.yml --profile ssl up -d certbot  # Запустить автообновление SSL
```

### Полезные curl-запросы

```bash
# Health
curl -s http://localhost:3000/api/health | jq

# Kratos — статус
curl -s http://localhost:4433/health/alive | jq
curl -s http://localhost:4434/admin/identities | jq '.[].id'

# Keto — статус
curl -s http://localhost:4466/health/ready | jq

# Права текущего пользователя (нужна сессионная кука)
curl -s http://localhost:3000/api/permissions -H 'Cookie: ory_kratos_session=...' | jq
```

---

## Переменные окружения — полный справочник

### `server/.env` (сервер)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `NODE_ENV` | `development` | `development` или `production` |
| `PORT` | `3000` | Порт Express-сервера |
| `SERVE_CLIENT` | `true` (dev) / `false` (prod) | Раздавать ли статику Angular |
| `KRATOS_PUBLIC_URL` | `http://localhost:4433` | URL Kratos Public API |
| `KETO_READ_URL` | `http://localhost:4466` | URL Keto Read API |
| `KETO_WRITE_URL` | `http://localhost:4467` | URL Keto Write API |
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | URL MQTT-брокера |
| `MQTT_CLIENT_ID` | `industrial-telemetry-server` | Идентификатор MQTT-клиента |
| `MQTT_USERNAME` | — | Логин MQTT (если требуется) |
| `MQTT_PASSWORD` | — | Пароль MQTT (если требуется) |
| `MQTT_TOPIC_PREFIX` | `industrial/` | Префикс MQTT-топиков |
| `CORS_ORIGIN` | `http://localhost:4200` | Разрешённые origin (через запятую) |

### `.env.yc` (продакшен)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `APP_URL` | — | Публичный URL приложения |
| `CORS_ORIGIN` | — | CORS origin (обычно совпадает с APP_URL) |
| `MQTT_USERNAME` | — | Логин MQTT |
| `MQTT_PASSWORD` | — | Пароль MQTT |
| `DB_PASSWORD` | `kratos` | Пароль PostgreSQL (пользователь `kratos`) |

---

## Файлы конфигурации — карта проекта

| Файл | Назначение |
|---|---|
| `docker-compose.yml` | Docker-стек для локальной разработки |
| `docker-compose.yc.yml` | Docker-стек для продакшена (Yandex Cloud) |
| `Dockerfile.server` | Сборка Express-сервера (multi-stage) |
| `Dockerfile.client` | Сборка Angular + Nginx (multi-stage) |
| `server/.env` | Переменные окружения Express-сервера |
| `.env.yc` | Переменные окружения для production-стека |
| `.env.yc.example` | Шаблон `.env.yc` |
| `kratos/kratos.yml` | Конфигурация Kratos (dev, без Docker) |
| `kratos/kratos.docker.yml` | Конфигурация Kratos (dev, внутри Docker) |
| `kratos/kratos.yc.yml` | Конфигурация Kratos (production) |
| `kratos/identity.schema.json` | Схема пользователя Kratos (email, username, role, department) |
| `keto/keto.yml` | Конфигурация Keto |
| `keto/namespaces.keto.ts` | OPL-модель пространств имён Keto |
| `nginx/nginx.yc.conf` | Конфигурация Nginx (reverse proxy + статика + HTTPS) |
| `mosquitto.conf` | Конфигурация MQTT-брокера |
| `client/proxy.conf.json` | Прокси для Angular dev-сервера |
| `cloud-config.yaml` | cloud-init для автоматической настройки ВМ |
| `scripts/deploy-yc.sh` | Скрипт быстрого деплоя на Yandex Cloud |
| `scripts/setup-https.sh` | Скрипт настройки HTTPS (Let's Encrypt) |
