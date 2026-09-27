# Industrial Telemetry — Руководство по развёртыванию (Production)

**Версия:** 4.0
**Дата:** 2026-09-27
**Стек:** Angular 22 (PWA, NG-ZORRO) · Express 4 (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14.0 · PostgreSQL 16 · Nginx
**Домен:** `industrial-telemetry.ru`
**Репозиторий:** `https://github.com/mechtool/industrial-telemetry.git` (публичный)
**Целевая ВМ:** Yandex Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD

> Актуальное состояние кода (HEAD `29820e8`). Документ описывает текущий prod-стек из `docker-compose.yc.yml`; локальная разработка — в `user-data/MANUAL_RUN_GUIDE.md`.

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Управление секретами](#2-управление-секретами)
3. [Первичная настройка ВМ](#3-первичная-настройка-вм)
4. [Клонирование и конфигурация](#4-клонирование-и-конфигурация)
5. [Сборка и запуск](#5-сборка-и-запуск)
6. [Обновление приложения (деплой)](#6-обновление-приложения-деплой)
7. [HTTPS (Let's Encrypt)](#7-https-lets-encrypt)
8. [Проверка после деплоя](#8-проверка-после-деплоя)
9. [Откат](#9-откат)
10. [Известные ограничения и план](#10-известные-ограничения-и-план)

---

## 1. Архитектура

```
Браузер ──► Nginx :80/:443 ──► /api/*          ──► Express Server :3000
                             ├─► /.ory/*       ──► Ory Kratos :4433
                             └─► /*            ──► Angular PWA (статика)

Express Server ──► Keto :4466/4467 (роли в Keto; поресурсные права пока не включены, см. §10)
Express Server ──► Mosquitto :1883 (MQTT)
Kratos ──► PostgreSQL :5432 (база `kratos`)
Keto   ──► PostgreSQL :5432 (база `keto`)
```

| Контейнер | Образ | Порт(ы) | Назначение |
|---|---|---|---|
| `it-kratos-db` | `postgres:16-alpine` | 5432 (internal) | База данных (Kratos + Keto, БД `keto` создаётся `keto/init-keto.sql`) |
| `it-kratos-migrate` | `oryd/kratos:v1.3.1` | — | Миграция схемы Kratos (одноразовая) |
| `it-kratos` | `oryd/kratos:v1.3.1` | 4433, 4434 | Identity Provider (public + admin API) |
| `it-keto-migrate` | `oryd/keto:v0.14.0` | — | Миграция схемы Keto (одноразовая) |
| `it-keto` | `oryd/keto:v0.14.0` | 4466, 4467 (internal) | Permission Server (RBAC) |
| `it-server` | `Dockerfile.server` | 3000 (internal) | Express API + MQTT-мост + Kratos-прокси |
| `it-client` | `Dockerfile.client` | 80, 443 | Nginx + Angular PWA |
| `it-mosquitto` | `eclipse-mosquitto:2` | 1883 | MQTT-брокер |
| `it-certbot` | `certbot/certbot` | — (profile `ssl`) | Автообновление сертификатов |

Собственные образы (`it-server`, `it-client`) собираются **внутри Docker** многостадийными `Dockerfile` — Node на ВМ для сборки не требуется. Keto доступен только внутри сети `it-network` (порты наружу не публикуются); Kratos (4433/4434) и Mosquitto (1883) опубликованы наружу — см. §10.

---

## 2. Управление секретами

Секреты **не хранятся в git**. В репозитории только шаблоны; реальные значения живут в gitignored-файлах на ВМ.

| Файл в репо (tracked) | Файл на ВМ (gitignored) | Что содержит |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `WEBHOOK_SECRET` |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | `secrets.cookie`, `secrets.cipher`, `courier.smtp.connection_uri`, `web_hook.auth.config.value` (общий секрет webhook) |

`.gitignore` уже содержит `.env`, `.env.local`, `.env.yc`, `.env.yc.*` (кроме `*.example`), `.codewhale/`, `certbot/`, `kratos/kratos.yc.yml`, `kratos/kratos.docker.yml`.

### 2.1 Генерация секретов Kratos

```bash
# cookie и cipher — РОВНО 32 hex-символа (16 байт):
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> ⚠️ Kratos требует `secrets.cookie` и `secrets.cipher` **ровно 32 символа** (min=max=32); длина 64 вызовет ошибку валидации.
>
> ⚠️ Kratos **не подставляет** `${VAR}` в конфиг-файл — плейсхолдеры трактуются буквально и падают с ошибкой валидации. Секреты прописываются в `kratos/kratos.yc.yml` напрямую.

### 2.2 Пример `.env.yc` (на ВМ)

```ini
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=<пароль-БД>
MQTT_USERNAME=
MQTT_PASSWORD=
WEBHOOK_SECRET=<секрет-webhook>
```

Секрет webhook (`WEBHOOK_SECRET`) должен **совпадать** с `web_hook.auth.config.value` в `kratos/kratos.yc.yml` (см. §2.3). Генерируется отдельно (можно любой длины, рекомендуется 64 hex):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Пример `kratos/kratos.yc.yml` (на ВМ)

Копируется из `kratos/kratos.yc.example.yml` и заполняется реальными значениями: `secrets.cookie`/`secrets.cipher` (32 hex), `courier.smtp.connection_uri` (SMTP-доступ отдельного ящика приложения `noreply@<домен>` либо транзакционного SMTP-сервиса) и `web_hook.auth.config.value` (= `WEBHOOK_SECRET` из `.env.yc`).

> Webhook Kratos шлёт секрет в заголовке `Authorization` **без префикса `Bearer`**; сервер сравнивает его со значением `WEBHOOK_SECRET` (см. `server/src/routes/webhooks.routes.ts`).

---

## 3. Первичная настройка ВМ

### 3.1 Создание ВМ (Yandex Cloud)

При создании ВМ вставить содержимое `cloud-config.yaml` в поле «cloud-init». Это автоматически:

- создаёт пользователя `mit-2` с `sudo` без пароля и SSH-ключом;
- устанавливает Docker (`docker.io`), Docker Compose v2 (`docker-compose-v2`), Git, Node.js 22;
- настраивает swap 2 GB.

### 3.2 Доступ по SSH

В `~/.ssh/config` (локально) настроен алиас:

```
Host yc-vm
    HostName 158.160.204.124
    User mit-2
    IdentityFile ~/.ssh/keys/yc-vm-key
    StrictHostKeyChecking no
```

Проверка:

```bash
ssh yc-vm "hostname && docker --version"
```

### 3.3 Ручная установка (если без cloud-init)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # перелогиниться

# Node.js 22 (нужен только если собирать вне Docker)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Swap 2 GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Либо воспользоваться готовым скриптом `scripts/deploy-yc.sh` (ставит Docker, клонирует репозиторий, создаёт `.env.yc`, получает сертификат, собирает и поднимает стек).

---

## 4. Клонирование и конфигурация

```bash
ssh yc-vm
cd ~
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

### 4.1 Создать реальные конфиги из шаблонов

```bash
# .env.yc — заполнить реальными значениями
cp .env.yc.example .env.yc
nano .env.yc

# kratos.yc.yml — заполнить реальными секретами (см. §2)
cp kratos/kratos.yc.example.yml kratos/kratos.yc.yml
nano kratos/kratos.yc.yml
```

> Эти два файла gitignored — `git pull` их не тронет. Они живут только на ВМ.

### 4.2 SSL-сертификат (Let's Encrypt)

Получается один раз (до старта nginx, порт 80 свободен):

```bash
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --agree-tos --email admin@industrial-telemetry.ru \
  -d industrial-telemetry.ru --non-interactive
```

Альтернатива — `scripts/setup-https.sh` (создаёт самоподписанный bootstrap-сертификат, поднимает nginx и получает сертификат через webroot).

---

## 5. Сборка и запуск

```bash
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

Порядок подъёма (определён `depends_on` + `healthcheck`):

1. `it-kratos-db` (PostgreSQL)
2. `it-kratos-migrate` + `it-keto-migrate` (миграции, одноразовые)
3. `it-kratos` + `it-keto`
4. `it-mosquitto` + `it-server`
5. `it-client` (nginx)

Проверить статус:

```bash
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
```

---

## 6. Обновление приложения (деплой)

Деплой идёт через git — на ВМ настроен `git` в `~/industrial-telemetry` с `origin = github.com/mechtool/industrial-telemetry.git` и трекингом `master`.

### 6.1 Локально: коммит и пуш

```bash
git add -A
git commit -m "описание изменений"
git push origin master
```

### 6.2 На ВМ: подтянуть и пересобрать

```bash
ssh yc-vm
cd ~/industrial-telemetry
git pull origin master

# пересобрать только изменённый сервис (client и/или server)
docker compose -f docker-compose.yc.yml --env-file .env.yc build client
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d client
```

Какие сервисы пересобирать:

- изменился только клиент (Angular) → `build client`;
- изменился сервер → `build server`;
- изменились конфиги Kratos/Keto/Mosquitto → достаточно `up -d <сервис>` (конфиги монтируются как volume, пересборка образа не нужна). Исключение — Kratos не перечитывает конфиг на лету, но `up -d kratos` пересоздаёт контейнер с новым конфигом.

> Один и тот же стек/имена контейнеров — при `up -d` compose пересоздаст только изменённые контейнеры; БД и сертификаты сохраняются в Docker-томах и `/etc/letsencrypt`.

---

## 7. HTTPS (Let's Encrypt)

Сертификаты монтируются в `it-client` (`/etc/letsencrypt:/etc/letsencrypt:ro`). Автообновление — контейнер `it-certbot` (profile `ssl`), `certbot renew` каждые 12 часов:

```bash
docker compose -f docker-compose.yc.yml --env-file .env.yc --profile ssl up -d certbot
```

Nginx-конфиг (`nginx/nginx.yc.conf`) содержит HTTP→HTTPS redirect, ACME-challenge и security-заголовки (HSTS, X-Frame-Options `DENY`, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP). CSP задаётся `<meta http-equiv="Content-Security-Policy">` в `client/src/index.html` (на уровне Nginx CSP-заголовка нет).

---

## 8. Проверка после деплоя

```bash
# статус контейнеров
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# API-сервер
curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy","uptime":...,"mqtt":"connected"}}

# Kratos жив
curl -s https://industrial-telemetry.ru/.ory/health/alive

# главная страница (PWA)
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/
# → 200

# логи
docker logs -f it-kratos
docker logs -f it-server
docker logs -f it-client
docker logs -f it-keto
docker logs -f it-mosquitto
```

Чек-лист:

- [ ] `/` отдаёт 200
- [ ] `/api/health` → `status: healthy`, `mqtt: connected`
- [ ] `/.ory/health/alive` → `{"status":"ok"}`
- [ ] регистрация нового пользователя
- [ ] у нового пользователя в Keto роль `viewer` (`/api/users` под админом, либо relation-tuples в `it-keto`)
- [ ] логин созданным аккаунтом → редирект на `/projects`
- [ ] список проектов (`/api/projects`) отдаёт 4 стартовых проекта
- [ ] дашборд показывает MQTT-статус
- [ ] под админом: список пользователей (`/api/users`) и смена ролей работают
- [ ] под админом: настройки (`/api/settings`) читаются и сохраняются
- [ ] logout → редирект на логин
- [ ] в логах `it-kratos` webhook `Dispatching webhook` без `webhook failed`

---

## 9. Откат

```bash
ssh yc-vm
cd ~/industrial-telemetry
git log --oneline -5          # найти стабильный коммит
git checkout <commit>         # или git reset --hard <commit>
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

Затем вернуть `master` на место: `git checkout master` (или `git reset --hard origin/master`).

---

## 10. Известные ограничения и план

### 10.1 RBAC (Keto): роли работают, поресурсные права — нет

Роли живут в Keto (relation tuples, namespace `Role`) и **работают**: `kratosAuth` читает их через `ketoService.listRoles()`, `/api/session` отдаёт `roles`, `requireAdmin` проверяет `roles.includes('admin')` — это защищает `/api/users` (список и `PUT /:id/roles`) и `PUT /api/settings`. Роль `viewer` назначается автоматически при регистрации (webhook + fallback).

Поресурсные права пока **не активированы**:

- `ketoService.seedDefaults()` не вызывается при старте сервера → разрешения на ресурсы (`dashboard`, `mqtt`, `mqtt-topics`, `users`, `settings`) не сидятся;
- `requirePermission` / `requireRole` / `loadPermissions` не применены к маршрутам (`/api/mqtt/*` защищён только `kratosAuth`);
- маршрута `/api/permissions` на сервере нет, а клиентский `PermissionsService.load()` (который ходит на `/api/permissions`) нигде не вызывается.

Следствие: все `/api/*` маршруты защищены аутентификацией (`kratosAuth`), админские операции — проверкой роли (`requireAdmin`), а поресурсной модели прав на уровне enforcement нет. Это задача ближайшего спринта (см. `user-data/NEXT_STEPS.md`).

> ⚠️ **Одноразовая миграция для существующих инсталляций:** при обновлении со старых версий (где роль лежала в `traits.role`) выполнить `cd server && npm run migrate:roles` до/вместе с перезапуском `it-server` — переносит `traits.role` → Keto и чистит `traits.role`. Идемпотентна.

### 10.2 Данные в памяти (без БД)

`/api/projects` и `/api/settings` используют in-memory хранилище на стороне сервера (`server/src/services/projects.service.ts`, `settings.service.ts`): данные теряются при перезапуске контейнера и не общие между репликами. Это dev-заглушки — перенос в PostgreSQL запланирован.

### 10.3 Безопасность — к ротации/доработке

- **MQTT** — `mosquitto.conf` использует `allow_anonymous true`; включить аутентификацию (`allow_anonymous false` + `password_file`).
- **SMTP-доступ приложения** — живёт в `courier.smtp.connection_uri` в `kratos/kratos.yc.yml`; пароль приложения хранить вне git. `from_address` должен совпадать с ящиком в `connection_uri` (иначе SPF/DKIM отклонят письмо).
- **Пароль БД** — сменить `kratos` по умолчанию через `ALTER USER` и обновить `DB_PASSWORD` в `.env.yc` + `dsn` в `kratos/kratos.yc.yml`/`keto/keto.yml`.
- **Порты наружу** — `it-kratos` (4433/4434) и `it-mosquitto` (1883) опубликованы; в проде их стоит закрыть в security group ВМ (наружу нужны только 80/443 через nginx).
- **Версия конфига Keto** — `keto/keto.yml` объявляет `version: v0.14.0-alpha.0`, тогда как compose использует образ `oryd/keto:v0.14.0`; при ошибке валидации Keto привести `version` в `keto.yml` к `v0.14.0`.

### 10.4 История git

История была переписана (`git filter-repo`) — секреты из старых коммитов удалены, репозиторий публичный. После force-push любые локальные клоны нужно пересинхронизировать: `git fetch origin && git reset --hard origin/master`.
