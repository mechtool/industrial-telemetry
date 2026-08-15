# Industrial Telemetry — Руководство по развёртыванию (Production)

**Версия:** 3.0
**Дата:** 2026-08-15
**Стек:** Angular 22 (PWA, NG-ZORRO) · Express (TypeScript ESM) · Mosquitto MQTT · Ory Kratos v1.3.1 · Ory Keto v0.14 · PostgreSQL 16 · Nginx
**Домен:** `industrial-telemetry.ru`
**Репозиторий:** `https://github.com/mechtool/industrial-telemetry.git` (публичный)
**Целевая ВМ:** Yandex Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD

> Что изменилось по сравнению с версией 2.0:
> 1. Секреты полностью вынесены из git (см. раздел «Управление секретами»).
> 2. Деплой переведён на `git pull` (на ВМ настроен git, репозиторий публичный).
> 3. Исправлен путь запуска сервера в `Dockerfile.server`.
> 4. История git переписана — секреты из старых коммитов удалены.

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

Express Server ──► Keto :4466/4467 (проверка прав — middleware объявлен, см. §10)
Express Server ──► Mosquitto :1883 (MQTT)
Kratos ──► PostgreSQL :5432 (база `kratos`)
Keto   ──► PostgreSQL :5432 (база `keto`)
```

| Контейнер | Образ | Порт(ы) | Назначение |
|---|---|---|---|
| `it-kratos-db` | `postgres:16-alpine` | 5432 (internal) | База данных (Kratos + Keto) |
| `it-kratos-migrate` | `oryd/kratos:v1.3.1` | — | Миграция схемы Kratos (одноразовая) |
| `it-kratos` | `oryd/kratos:v1.3.1` | 4433, 4434 | Identity Provider |
| `it-keto-migrate` | `oryd/keto:v0.14.0-alpha.0` | — | Миграция схемы Keto (одноразовая) |
| `it-keto` | `oryd/keto:v0.14.0-alpha.0` | 4466, 4467 | Permission Server (RBAC) |
| `it-server` | `Dockerfile.server` | 3000 (internal) | Express API + MQTT-мост |
| `it-client` | `Dockerfile.client` | 80, 443 | Nginx + Angular PWA |
| `it-mosquitto` | `eclipse-mosquitto:2` | 1883 | MQTT-брокер |
| `it-certbot` | `certbot/certbot` | — (profile `ssl`) | Автообновление сертификатов |

Оба собственных образа (`it-server`, `it-client`) собираются **внутри Docker** (многостадийные `Dockerfile`), поэтому на ВМ не нужен ни Node, ни предварительная сборка.

---

## 2. Управление секретами

**Секреты не хранятся в git.** В репозитории лежат только шаблоны, а реальные значения живут в gitignored-файлах на ВМ.

| Файл в репо (tracked) | Файл на ВМ (gitignored) | Что содержит |
|---|---|---|
| `.env.yc.example` | `.env.yc` | `DOMAIN`, `DB_PASSWORD`, `MQTT_USERNAME`, `MQTT_PASSWORD` |
| `kratos/kratos.yc.example.yml` | `kratos/kratos.yc.yml` | Конфигурация Kratos: `secrets.cookie`, `secrets.cipher`, `courier.smtp.connection_uri` |

`.gitignore` уже содержит `.env`, `.env.*`, `.env.yc*` (кроме `*.example`), `.codewhale/`, `certbot/`, `kratos/kratos.yc.yml`.

### 2.1 Генерация секретов Kratos

```bash
# cookie и cipher — РОВНО 32 hex-символа (16 байт):
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> ⚠️ Важно: Kratos требует `secrets.cookie` и `secrets.cipher` **ровно 32 символа** (min=max=32). Значение длиной 64 символа вызовет ошибку `length must be <= 32`.
>
> ⚠️ Kratos **не поддерживает** подстановку `${VAR}` в конфиг-файле — такие плейсхолдеры он трактует буквально и падает с ошибкой валидации. Секреты должны быть прописаны в `kratos/kratos.yc.yml` напрямую.

### 2.2 Пример `.env.yc` (на ВМ)

```ini
DOMAIN=industrial-telemetry.ru
DB_PASSWORD=<пароль-БД>
MQTT_USERNAME=
MQTT_PASSWORD=
```

### 2.3 Пример `kratos/kratos.yc.yml` (на ВМ)

Копируется из `kratos/kratos.yc.example.yml` и заполняется реальными `secrets.cookie`, `secrets.cipher` (32 hex) и `courier.smtp.connection_uri`.

---

## 3. Первичная настройка ВМ

### 3.1 Создание ВМ (Yandex Cloud)

При создании ВМ вставить содержимое `cloud-config.yaml` в поле «cloud-init». Это автоматически:
- создаёт пользователя `mit-2` с `sudo` без пароля и SSH-ключом;
- устанавливает Docker, Docker Compose, Git, Node.js 22;
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

Деплой теперь идёт через git — на ВМ настроен `git` в `~/industrial-telemetry` с `origin = github.com/mechtool/industrial-telemetry.git` и трекингом `master`.

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
- изменились конфиги Kratos/Keto/Mosquitto → достаточно `up -d <сервис>` (конфиги монтируются как volume, пересборка образа не нужна).

> Один и тот же стек/имена контейнеров — при `up -d` compose пересоздаст только изменённые контейнеры; БД и сертификаты сохраняются в Docker-томах и `/etc/letsencrypt`.

---

## 7. HTTPS (Let's Encrypt)

Сертификаты монтируются в `it-client` (`/etc/letsencrypt:/etc/letsencrypt:ro`). Автообновление — контейнер `it-certbot` (profile `ssl`), каждые 12 часов:

```bash
docker compose -f docker-compose.yc.yml --env-file .env.yc --profile ssl up -d certbot
```

Nginx-конфиг (`nginx/nginx.yc.conf`) уже содержит HTTP→HTTPS redirect, ACME-challenge и security-заголовки (HSTS, X-Frame-Options, CSP и др.).

---

## 8. Проверка после деплоя

```bash
# статус контейнеров
docker compose -f docker-compose.yc.yml --env-file .env.yc ps

# API-сервер
curl -s https://industrial-telemetry.ru/api/health
# → {"success":true,"data":{"status":"healthy",...,"mqtt":"connected"}}

# Kratos жив
curl -s https://industrial-telemetry.ru/.ory/health/alive

# главная страница (PWA)
curl -s -o /dev/null -w "%{http_code}\n" https://industrial-telemetry.ru/
# → 200

# логи
docker logs -f it-kratos
docker logs -f it-server
docker logs -f it-client
```

Чек-лист:
- [ ] `/` отдаёт 200
- [ ] `/api/health` → `status: healthy`
- [ ] `/.ory/health/alive` → `ok`
- [ ] регистрация нового пользователя
- [ ] логин созданным аккаунтом
- [ ] дашборд показывает MQTT-статус
- [ ] logout → редирект на логин

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

### 10.1 RBAC (Keto) пока не подключён

Код RBAC написан, но **не активирован**:
- `ketoService.seedDefaults()` не вызывается при старте сервера → роли/права не сидятся;
- `requirePermission` / `requireRole` / `loadPermissions` не применены к маршрутам `/api/mqtt/*`;
- маршрута `/api/permissions` на сервере нет, а клиентский `PermissionsService.load()` нигде не вызывается.

Следствие: сейчас `/api/mqtt/*` защищён только аутентификацией (`kratosAuth`), а dashboard не скрывает/показывает кнопки по ролям. Это задача ближайшего спринта (см. `user-data/NEXT_STEPS.md`).

### 10.2 Секреты, требующие ротации

- **SMTP-пароль Яндекса** — был в git-истории до перезаписи; сменить (пароль приложения в аккаунте Яндекса) и обновить `courier.smtp.connection_uri` в `kratos/kratos.yc.yml`.
- **Пароль БД** (`kratos` по умолчанию) — сменить через `ALTER USER` и обновить `DB_PASSWORD` в `.env.yc` + `dsn` в `kratos/kratos.yc.yml`/`keto/keto.yml`.
- **MQTT** — `mosquitto.conf` использует `allow_anonymous true`; включить аутентификацию (`allow_anonymous false` + `password_file`).

### 10.3 История git

История переписана (`git filter-repo`), секреты из старых коммитов удалены, репозиторий публичный. Force-push меняет хеши всех коммитов — после него любые локальные клоны нужно пересинхронизировать (`git fetch origin && git reset --hard origin/master`).
