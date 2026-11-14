# Industrial Telemetry — Руководство по развёртыванию (Production)

**Версия:** 6.0
**Дата:** 2026-11-14
**Стек:** Angular 22 (PWA, NG-ZORRO, zoneless) · Express 4 (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14.0 · PostgreSQL 16 · Nginx
**Домен:** `industrial-telemetry.ru`
**Репозиторий:** `https://github.com/mechtool/industrial-telemetry.git` (публичный)
**Целевая ВМ:** Yandex Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD

> Актуальное состояние кода (HEAD `1d8eca1`). Документ описывает prod-стек из `docker-compose.yc.yml`; локальная разработка — `user-data/MANUAL_RUN_GUIDE.md`, план развития — `user-data/DEVELOPMENT_PLAN.md`.
>
> Что изменилось к v6.0: регистрация стала двухшаговой (pending-запись → письмо → подтверждение по ссылке `/api/kratos/verify-email`); разделены два SMTP-канала — `SMTP_URI` (Kratos, recovery) и `SMTP_URL`/`MAIL_FROM`/`APP_BASE_URL` (сервер, подтверждение регистрации).

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
Шлюз Waveshare ──► Mosquitto :1883 ──► Keeper ──► PostgreSQL :5432 (база `telemetry`)
Kratos ──► PostgreSQL :5432 (база `kratos`)
Keto   ──► PostgreSQL :5432 (база `keto`)
```

| Контейнер | Образ | Порт(ы) | Назначение |
|---|---|---|---|
| `it-kratos-db` | `postgres:16-alpine` | 5432 (internal) | БД (Kratos + Keto + telemetry; БД `keto` создаётся `keto/init-keto.sql`) |
| `it-kratos-migrate` | `oryd/kratos:v1.3.1` | — | Миграция схемы Kratos (одноразовая) |
| `it-kratos` | `oryd/kratos:v1.3.1` | 4433, 4434 | Identity Provider (public + admin API) |
| `it-keto-migrate` | `oryd/keto:v0.14.0` | — | Миграция схемы Keto (одноразовая) |
| `it-keto` | `oryd/keto:v0.14.0` | 4466, 4467 (internal) | Permission Server (RBAC) |
| `it-server` | `Dockerfile.server` | 3000 (internal) | Express API + MQTT-мост + Kratos-прокси + DaData + письма подтверждения регистрации |
| `it-mosquitto` | `eclipse-mosquitto:2` | 1883 | MQTT-брокер |
| `it-telemetry-migrate` | `postgres:16-alpine` | — | Создание БД `telemetry` + схема (одноразовая) |
| `it-keeper` | `Dockerfile.server` | 3100 (health) | Хранитель телеметрии: MQTT → normalize → PostgreSQL |
| `it-client` | `Dockerfile.client` | 80, 443 | Nginx + Angular PWA |
| `it-certbot` | `certbot/certbot` | — (profile `ssl`) | Автообновление сертификатов |

Собственные образы (`it-server`, `it-keeper`, `it-client`) собираются **внутри Docker** многостадийными `Dockerfile` — Node на ВМ для сборки не требуется. `it-keeper` использует тот же `Dockerfile.server`, что и `it-server`, но с точкой входа `dist/src/keeper.js`. Keto доступен только внутри сети `it-network`; Kratos (4433/4434) и Mosquitto (1883) опубликованы наружу — см. §10.

---

## 2. Управление секретами

Секреты **не хранятся в git**. В репозитории только шаблоны; реальные значения живут в gitignored-файлах на ВМ.

| Файл в репо (tracked) | Файл на ВМ (gitignored) | Что содержит |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `WEBHOOK_SECRET`, `DADATA_API_KEY`, `SMTP_URI` (Kratos), `SMTP_URL`, `SMTP_REJECT_UNAUTHORIZED`, `MAIL_FROM`, `APP_BASE_URL` (сервер) |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | `secrets.cookie`, `secrets.cipher`, `web_hook.auth.config.value` (общий секрет webhook) |

`.gitignore` уже содержит `.env`, `.env.local`, `.env.yc`, `.env.yc.*` (кроме `*.example`), `.codewhale/`, `certbot/`, `kratos/kratos.yc.yml`, `kratos/kratos.docker.yml`, `lighthouse/`, `dist/`, `*.log`, `.npm-cache/`.

### 2.1 Генерация секретов Kratos

```bash
# cookie и cipher — РОВНО 32 hex-символа (16 байт):
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> ⚠️ Kratos требует `secrets.cookie` и `secrets.cipher` **ровно 32 символа** (min=max=32).
>
> ⚠️ Kratos **не подставляет** `${VAR}` в конфиг-файл — плейсхолдеры трактуются буквально. Исключение — `SMTP_URI`: в compose `kratos` обрабатывается командой `sed "s|__SMTP_URI__|$SMTP_URI|g"` перед запуском, поэтому SMTP задаётся переменной окружения, а не в файле.

### 2.2 Пример `.env.yc` (на ВМ)

```ini
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=<пароль-БД>
MQTT_USERNAME=
MQTT_PASSWORD=
WEBHOOK_SECRET=<секрет-webhook>
DADATA_API_KEY=<ключ-DaData>

# Kratos: письма восстановления пароля
SMTP_URI=smtps://<логин>:<пароль>@smtp.yandex.ru:465

# Сервер: письма подтверждения регистрации (nodemailer)
SMTP_URL=smtps://<логин>:<пароль>@smtp.yandex.ru:465
SMTP_REJECT_UNAUTHORIZED=true
MAIL_FROM=noreply@industrial-telemetry.ru
APP_BASE_URL=https://industrial-telemetry.ru
```

> ⚠️ **Два SMTP-канала.** `SMTP_URI` — письма восстановления пароля (читает Kratos); `SMTP_URL` — письма подтверждения регистрации (читает сервер). Без `SMTP_URL` письма подтверждения молча не уходят (в логе `it-server` предупреждение). `MAIL_FROM` должен принадлежать домену, подтверждённому у провайдера.

Секрет webhook (`WEBHOOK_SECRET`) должен **совпадать** с `web_hook.auth.config.value` в `kratos/kratos.yc.yml` (см. §2.3):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Пример `kratos/kratos.yc.yml` (на ВМ)

Копируется из `kratos/kratos.yc.example.yml` и заполняется реальными значениями: `secrets.cookie`/`secrets.cipher` (32 hex) и `web_hook.auth.config.value` (= `WEBHOOK_SECRET`). SMTP в файл не пишется — он приходит через `SMTP_URI` (см. §2.1).

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

Проверка: `ssh yc-vm "hostname && docker --version"`.

### 3.3 Ручная установка (если без cloud-init)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # перелогиниться
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash
sudo apt install -y nodejs
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Либо готовый скрипт `scripts/deploy-yc.sh`.

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
cp .env.yc.example .env.yc
nano .env.yc

cp kratos/kratos.yc.example.yml kratos/kratos.yc.yml
nano kratos/kratos.yc.yml
```

> Эти два файла gitignored — `git pull` их не тронет.

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

Альтернатива — `scripts/setup-https.sh`.

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
5. `it-telemetry-migrate` → `it-keeper`
6. `it-client` (nginx)

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

docker compose -f docker-compose.yc.yml --env-file .env.yc build client
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d client
```

Какие сервисы пересобирать:

- изменился только клиент (Angular) → `build client`;
- изменился сервер или keeper → `build server` (keeper использует тот же образ);
- изменились конфиги Kratos/Keto/Mosquitto → достаточно `up -d <сервис>` (конфиги монтируются как volume). Kratos не перечитывает конфиг на лету — `up -d kratos` пересоздаёт контейнер с новым конфигом.

---

## 7. HTTPS (Let's Encrypt)

Сертификаты монтируются в `it-client` (`/etc/letsencrypt:/etc/letsencrypt:ro`), webroot ACME-challenge — volume `certbot-webroot` (`/var/www/certbot`).

**Автообновление** — хост-скрипт `scripts/renew-cert.sh` (webroot `certbot renew` + `docker exec it-client nginx -s reload`), запускается cron на ВМ дважды в сутки:

```bash
# на ВМ: crontab -e (пользователь mit-2)
0 3,15 * * * /home/mit-2/industrial-telemetry/scripts/renew-cert.sh >> /home/mit-2/industrial-telemetry/renew-cert.log 2>&1
```

Скрипт обновляет сертификат через `certbot renew --webroot --webroot-path=/var/www/certbot` и затем перезагружает nginx, чтобы подхватить новый сертификат.

> В compose остался сервис `certbot` (profile `ssl`, `certbot renew` каждые 12 часов), но он **не перезагружает nginx** после обновления — предпочтительнее `scripts/renew-cert.sh` по cron.

Nginx-конфиг (`nginx/nginx.yc.conf`) содержит HTTP→HTTPS redirect, ACME-challenge и security-заголовки (HSTS, X-Frame-Options `DENY`, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP). CSP задаётся `<meta http-equiv="Content-Security-Policy">` в `client/src/index.html`.

---

## 8. Проверка после деплоя

```bash
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# API-сервер
curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy","uptime":...,"mqtt":"connected"}}

# Kratos жив
curl -s https://industrial-telemetry.ru/.ory/health/alive

# главная страница (PWA)
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/   # → 200

# хранитель телеметрии
ssh yc-vm "curl -s http://localhost:3100/health"
ssh yc-vm "docker exec it-kratos-db psql -U kratos -d telemetry -c 'SELECT count(*) FROM telemetry'"
```

Чек-лист:

- [ ] `/` отдаёт 200
- [ ] `/api/health` → `status: healthy`, `mqtt: connected`
- [ ] `/.ory/health/alive` → `{"status":"ok"}`
- [ ] регистрация: форма → экран «Проверьте почту» → письмо приходит (`SMTP_URL`) → клик по ссылке → редирект в приложение
- [ ] у нового пользователя в Keto роль `viewer` (под админом `/api/users`, либо relation-tuples в `it-keto`)
- [ ] recovery: письмо восстановления приходит (`SMTP_URI`), смена пароля работает
- [ ] логин созданным аккаунтом → главная «CRYOMON»
- [ ] список проектов (`/api/projects`) отдаёт стартовые проекты
- [ ] под админом: список пользователей (`/api/users`) и смена ролей работают
- [ ] под админом: настройки (`/api/settings`) читаются и сохраняются
- [ ] logout → редирект на логин
- [ ] `it-keeper` в статусе Up, `:3100/health` → `mqtt: connected`, `database: ok`
- [ ] в логах `it-kratos` webhook `Dispatching webhook` без `webhook failed`

---

## 9. Откат

```bash
ssh yc-vm
cd ~/industrial-telemetry
git log --oneline -5
git checkout <commit>   # или git reset --hard <commit>
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
git checkout master
```

Данные БД и сертификаты при откате сохраняются (Docker-тома + `/etc/letsencrypt`).

---

## 10. Известные ограничения и план

### 10.1 RBAC (Keto): роли работают, поресурсные права — нет

Роли живут в Keto (relation tuples, namespace `Role`) и **работают**: `kratosAuth` читает их через `ketoService.listRoles()`, `/api/session` отдаёт `roles`, `requireAdmin` проверяет `roles.includes('admin')` — защищает `/api/users` и `PUT /api/settings`. Роль `viewer` назначается автоматически при регистрации — двумя механизмами: `registerIdentity()` на сервере (в `GET /api/kratos/verify-email`) и webhook Kratos (`POST /api/webhooks/registration`).

Поресурсные права пока **не активированы**:

- `ketoService.seedDefaults()` не вызывается при старте сервера → разрешения на ресурсы (`dashboard`, `mqtt`, `mqtt-topics`, `users`, `settings`) не сидятся;
- `requirePermission` / `requireRole` / `loadPermissions` не применены к маршрутам (`/api/mqtt/*` защищён только `kratosAuth`);
- маршрута `/api/permissions` на сервере нет; клиентский `PermissionsService` (ходит на `/api/permissions`) существует, но нигде не внедряется — мёртвый код.

Это задача `user-data/DEVELOPMENT_PLAN.md` (Фаза 3).

> ⚠️ **Одноразовая миграция для существующих инсталляций:** при обновлении со старых версий (где роль лежала в `traits.role`) выполнить `cd server && npm run migrate:roles` до/вместе с перезапуском `it-server`.

### 10.2 Данные в памяти (без БД)

`/api/projects` и `/api/settings` используют in-memory хранилище (`server/src/services/projects.service.ts`, `settings.service.ts`): данные теряются при перезапуске контейнера. Разделы «Объекты/Шлюзы/Организации/Пользователи» внутри проекта — клиентские заготовки без серверных моделей. Перенос в PostgreSQL — `DEVELOPMENT_PLAN.md` (Фаза 3).

### 10.3 Телеметрия

Данные шлюза пишутся keeper'ом в таблицу `telemetry`, но API телеметрии нет — клиент их пока не показывает. Ретеншен отсутствует, таблица растёт. Задачи — `DEVELOPMENT_PLAN.md` (Фазы 1 и 4).

### 10.4 Безопасность — к ротации/доработке

- **MQTT** — `mosquitto.conf` использует `allow_anonymous true`; включить `allow_anonymous false` + `password_file` (+ TLS 8883).
- **SMTP-доступ** — два канала через env, вне git: `SMTP_URI` (Kratos, recovery) и `SMTP_URL` (сервер, подтверждение регистрации). `from_address` (Kratos) и `MAIL_FROM` (сервер) должны принадлежать домену, подтверждённому у провайдера (иначе SPF/DKIM отклонят письмо).
- **Пароль БД** — сменить `kratos` по умолчанию через `ALTER USER` и обновить `DB_PASSWORD` в `.env.yc` + `dsn`.
- **Порты наружу** — `it-kratos` (4433/4434) и `it-mosquitto` (1883) опубликованы; в проде их стоит закрыть в security group ВМ (наружу нужны только 80/443 через nginx).
- **Версия конфига Keto** — исправлено: `keto/keto.yml` объявляет `version: v0.14.0`, compose использует `oryd/keto:v0.14.0`.

### 10.5 История git

История была переписана (`git filter-repo`) — секреты из старых коммитов удалены, репозиторий публичный. После force-push локальные клоны пересинхронизировать: `git fetch origin && git reset --hard origin/master`.
