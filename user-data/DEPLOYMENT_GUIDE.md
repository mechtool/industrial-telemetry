# Industrial Telemetry — Руководство по развёртыванию

**Версия:** 2.0
**Дата:** 2026-08-02
**Стек:** Angular 22 (PWA) + Express + MQTT (Mosquitto) + Ory Kratos + Ory Keto (RBAC) + PostgreSQL + Nginx
**Целевая ВМ:** Yandex Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Требования](#2-требования)
3. [Этап 0: Подготовка конфигов](#3-этап-0-подготовка-конфигов)
4. [Этап 1: Настройка ВМ](#4-этап-1-настройка-вм)
5. [Этап 2: Перенос проекта и сборка](#5-этап-2-перенос-проекта-и-сборка)
6. [Этап 3: Конфигурация .env.yc](#6-этап-3-конфигурация-envyc)
7. [Этап 4: Запуск Docker-стека](#7-этап-4-запуск-docker-стека)
8. [Этап 5: Настройка RBAC (Keto)](#8-этап-5-настройка-rbac-keto)
9. [Этап 6: Открытие портов](#9-этап-6-открытие-портов)
10. [Этап 7: DNS и домен](#10-этап-7-dns-и-домен)
11. [Этап 8: HTTPS (Let's Encrypt)](#11-этап-8-https-lets-encrypt)
12. [Верификация](#12-верификация)
13. [Устранение неполадок](#13-устранение-неполадок)
14. [Обслуживание](#14-обслуживание)

---

## 1. Архитектура

```
Браузер → Nginx :80/443 → /api/*          → Express Server :3000
                          → /.ory/*        → Ory Kratos :4433
                          → /*             → Angular PWA (статика)

Express Server → Keto :4466/4467 (проверка прав)
Express Server → Mosquitto MQTT :1883
Kratos → PostgreSQL :5432 (база `kratos`)
Keto   → PostgreSQL :5432 (база `keto`)
```

| Контейнер | Порт(ы) | Образ | Назначение |
|---|---|---|---|
| `it-kratos-db` | 5432 (internal) | `postgres:16-alpine` | База данных (Kratos + Keto) |
| `it-kratos-migrate` | — | `oryd/kratos:v1.3.1` | Миграция схемы Kratos (одноразовый) |
| `it-kratos` | 4433, 4434 | `oryd/kratos:v1.3.1` | Identity Provider |
| `it-keto-migrate` | — | `oryd/keto:v0.14` | Миграция схемы Keto (одноразовый) |
| `it-keto` | 4466, 4467 | `oryd/keto:v0.14` | Permission Server (RBAC) |
| `it-mosquitto` | 1883 (internal) | `eclipse-mosquitto:2` | MQTT-брокер |
| `it-server` | 3000 (internal) | Сборка `Dockerfile.server` | Express API |
| `it-client` | 80, 443 | Сборка `Dockerfile.client` | Nginx + Angular PWA |

---

## 2. Требования

### Локальная машина
- Git, Node.js ≥ 22, SSH-клиент

### ВМ (Yandex Cloud)
- Ubuntu 24.04 LTS, 2 vCPU, ≥ 4 GB RAM, ≥ 20 GB диск
- Пользователь с `sudo` (NOPASSWD), внешний IP

---

## 3. Этап 0: Подготовка конфигов

Выполняется **на локальной машине**, один раз.

### 3.1 Клонирование

```bash
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

### 3.2 Настройка IP/домена

Заменить `<ВАШ_IP_ИЛИ_ДОМЕН>` в файлах:

**.env.yc:**
```ini
APP_URL=https://<ВАШ_IP_ИЛИ_ДОМЕН>
CORS_ORIGIN=https://<ВАШ_IP_ИЛИ_ДОМЕН>
```

**kratos/kratos.yc.yml** — 14 строк с `base_url`, `allowed_return_urls`, все `ui_url`.

**nginx/nginx.yc.conf:**
```nginx
server_name <ВАШ_IP_ИЛИ_ДОМЕН>;
```

### 3.3 Секреты

Сгенерировать секреты для Kratos:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # ×2
```

Заменить в `kratos/kratos.yc.yml` → `secrets.cookie` и `secrets.cipher`.

Заменить SMTP-пароль в `courier.smtp.connection_uri`.

---

## 4. Этап 1: Настройка ВМ

```bash
ssh -i <ключ> <пользователь>@<IP_ВМ>
```

### 4.1 Система

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release
```

### 4.2 Docker

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# → выйти из SSH и зайти заново
```

### 4.3 Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 4.4 Swap (рекомендовано)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 5. Этап 2: Перенос проекта и сборка

### 5.1 Клонирование на ВМ

```bash
cd ~
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

### 5.2 Установка и сборка

```bash
cd server && npm ci && npm run build && cd ..
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
```

---

## 6. Этап 3: Конфигурация .env.yc

```bash
cat ~/industrial-telemetry/.env.yc
```

Ожидаемое содержимое:
```ini
APP_URL=https://<ДОМЕН>
CORS_ORIGIN=https://<ДОМЕН>
MQTT_USERNAME=
MQTT_PASSWORD=
DB_PASSWORD=kratos
```

---

## 7. Этап 4: Запуск Docker-стека

```bash
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml --env-file .env.yc build --no-cache
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

Порядок запуска:
1. `it-kratos-db` — PostgreSQL
2. `it-kratos-migrate` + `it-keto-migrate` — миграции
3. `it-mosquitto` — MQTT
4. `it-kratos` + `it-keto` — Identity + Permissions
5. `it-server` — Express API
6. `it-client` — Nginx + Angular

### Проверка статуса

```bash
docker compose -f docker-compose.yc.yml ps
```

Ожидаемый вывод: 6 контейнеров `Up`, 2 `Exited (0)` (миграции).

---

## 8. Этап 5: Настройка RBAC (Keto)

Keto автоматически seed'ит роли и разрешения при старте сервера. Ролевая модель:

| Ресурс | operator | engineer | admin |
|---|---|---|---|
| Dashboard | просмотр | просмотр + edit | полный |
| MQTT | просмотр | просмотр + edit | полный |
| MQTT Topics | просмотр | просмотр + edit | полный |
| Users | — | просмотр | полный |
| Settings | — | просмотр + edit | полный |

### Назначение роли пользователю

После регистрации пользователь получает роль `operator` по умолчанию (Kratos identity traits). Для повышения роли — API:

```bash
# Назначить роль admin пользователю с ID <user-uuid>
curl -X PUT http://localhost:4467/admin/relation-tuples \
  -H 'Content-Type: application/json' \
  -d '{"namespace":"Role","object":"admin","relation":"member","subject_id":"<user-uuid>"}'
```

---

## 9. Этап 6: Открытие портов

В Security Group Yandex Cloud открыть порты 80 и 443:

```bash
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=80,protocol=tcp,v4-cidrs=0.0.0.0/0
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=443,protocol=tcp,v4-cidrs=0.0.0.0/0
```

---

## 10. Этап 7: DNS и домен

1. В панели регистратора: A-запись домена → внешний IP ВМ
2. Проверка: `nslookup <домен>` (должен показать IP ВМ)

---

## 11. Этап 8: HTTPS (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install -y certbot

# Выпуск сертификата (webroot, порт 80 должен быть открыт)
sudo certbot certonly --webroot -w /var/www/certbot \
  -d <домен> --email <email> --agree-tos --non-interactive

# Проверка автообновления
sudo certbot renew --dry-run
```

Сертификаты монтируются в `it-client` через volume `/etc/letsencrypt:/etc/letsencrypt:ro`. Certbot-контейнер в docker-compose автоматически обновляет сертификаты каждые 12 часов.

---

## 12. Верификация

| Endpoint | Ожидаемый ответ |
|---|---|
| `https://<домен>/` | Angular PWA |
| `https://<домен>/api/health` | `{"success":true,"data":{"status":"healthy"}}` |
| `https://<домен>/.ory/health/alive` | `{"status":"ok"}` |
| `https://<домен>/api/permissions` | `{"success":true,"data":{...}}` |

### End-to-end

1. Открыть `https://<домен>/` → страница входа
2. Регистрация: email + username + пароль
3. После верификации → редирект на `/dashboard`
4. В консоли браузера: `GET /api/permissions` → `{"canViewDashboard":true,...}`
5. Logout → редирект на `/login`

---

## 13. Устранение неполадок

| Симптом | Проверка | Решение |
|---|---|---|
| 502 Bad Gateway | `docker logs it-server` | Kratos/Keto не отвечает — проверить статус контейнеров |
| 504 Gateway Timeout | `docker logs it-server` | Keto recovery fetch завис — увеличить таймаут или перезапустить |
| 401 Unauthorized | Куки сессии | Сессия истекла — перелогиниться |
| 403 Forbidden | `GET /api/permissions` | Нет прав — проверить роль через Keto |
| Nginx 404 | `docker logs it-client` | Статика не собрана — `npm run build` в `client/` |

---

## 14. Обслуживание

### Обновление приложения

```bash
cd ~/industrial-telemetry
git pull
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
cd server && npm ci && npm run build && cd ..
docker compose -f docker-compose.yc.yml build --no-cache
docker compose -f docker-compose.yc.yml up -d
```

### Бэкап БД

```bash
# Kratos
docker exec it-kratos-db pg_dump -U kratos kratos > kratos-backup-$(date +%Y%m%d).sql

# Keto
docker exec it-kratos-db pg_dump -U kratos keto > keto-backup-$(date +%Y%m%d).sql
```

### Мониторинг

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
docker stats --no-stream
df -h /
```

### Шпаргалка

```bash
# Статус
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml ps

# Логи
docker compose -f docker-compose.yc.yml logs --tail=50

# Перезапуск одного сервиса
docker compose -f docker-compose.yc.yml restart server

# Полная остановка
docker compose -f docker-compose.yc.yml down        # сохранить данные
docker compose -f docker-compose.yc.yml down -v     # удалить всё
```
