# Industrial Telemetry — Руководство по ручному развёртыванию

**Версия:** 1.1  
**Дата:** 2026-07-26  
**Стек:** Angular 22 (PWA) + Express + MQTT (Mosquitto) + Ory Kratos + PostgreSQL + Nginx  
**Целевая ВМ:** Yandex Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD  

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Требования](#2-требования)
3. [Этап 0: Подготовка конфигов на локальной машине](#3-этап-0-подготовка-конфигов)
4. [Этап 1: Настройка ВМ](#4-этап-1-настройка-вм)
5. [Этап 2: Перенос проекта и сборка](#5-этап-2-перенос-проекта-и-сборка)
6. [Этап 3: Конфигурация .env.yc на ВМ](#6-этап-3-конфигурация-envyc)
7. [Этап 4: Запуск Docker-стека](#7-этап-4-запуск-docker-стека)
8. [Этап 5: Открытие портов](#8-этап-5-открытие-портов)
9. [Этап 6: Настройка DNS и домена](#9-этап-6-настройка-dns-и-домена)
10. [Этап 7: Верификация](#10-этап-7-верификация)
11. [Устранение неполадок](#11-устранение-неполадок)
12. [Откат изменений](#12-откат-изменений)
13. [Обслуживание](#13-обслуживание)

---

## 1. Архитектура

```
Браузер → Nginx :80 → /api/*       → Express Server :3000
                      → /.ory/*     → Ory Kratos :4433
                      → /*          → Angular PWA (статика)

Express Server → Mosquitto MQTT :1883
Kratos → PostgreSQL :5432
```

| Контейнер | Образ | Назначение |
|-----------|-------|-----------|
| `it-kratos-db` | `postgres:16-alpine` | База данных Kratos |
| `it-kratos-migrate` | `oryd/kratos:v1.3.1` | Миграция схемы БД (одноразовый) |
| `it-kratos` | `oryd/kratos:v1.3.1` | Identity Provider (регистрация/логин) |
| `it-mosquitto` | `eclipse-mosquitto:2` | MQTT-брокер |
| `it-server` | Сборка из `Dockerfile.server` | Express API |
| `it-nginx` | `nginx:alpine` | Reverse proxy + статика Angular |

---

## 2. Требования

### Локальная машина
- Git
- Node.js ≥ 22
- SSH-клиент
- SSH-ключ для доступа к ВМ

### ВМ (Yandex Cloud)
- Ubuntu 24.04 LTS
- 2 vCPU, ≥ 4 GB RAM, ≥ 20 GB диск
- Пользователь с `sudo` (NOPASSWD)
- Внешний IP-адрес

### Домен (опционально)
- Домен, указывающий на внешний IP ВМ (A-запись)

---

## 3. Этап 0: Подготовка конфигов

Выполняется **на локальной машине**, один раз.

### 3.1 Клонирование репозитория

```bash
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

### 3.2 Настройка домена/IP в конфигах

Нужно заменить `<ВАШ_IP_ИЛИ_ДОМЕН>` на реальный адрес в двух файлах.

**Файл `.env.yc`:**
```ini
APP_URL=http://<ВАШ_IP_ИЛИ_ДОМЕН>
CORS_ORIGIN=http://<ВАШ_IP_ИЛИ_ДОМЕН>
MQTT_USERNAME=
MQTT_PASSWORD=
```

**Файл `kratos/kratos.yc.yml`** — 13 строк с URL нужно обновить.  
Заменить `<ВАШ_IP_ИЛИ_ДОМЕН>` во всех вхождениях:
- `base_url`
- `default_browser_return_url`
- `allowed_return_urls` (4 строки)
- `ui_url` в секциях: `error`, `login`, `registration`, `settings`, `recovery`, `verification`
- `default_browser_return_url` в секции `logout`

**Файл `nginx/nginx.yc.conf`:**
```nginx
server_name <ВАШ_IP_ИЛИ_ДОМЕН>;
```

**Файл `client/src/index.html`:**
```html
<link rel="canonical" href="https://<ВАШ_IP_ИЛИ_ДОМЕН>">
```

### 3.3 Секреты Kratos

В файле `kratos/kratos.yc.yml` заменить `cookie` и `cipher` секреты.  
**Важно:** каждый секрет должен быть ≤ 32 символа! Генерация:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Вывод — 32 hex-символа. Сгенерировать дважды (для cookie и cipher).

```yaml
secrets:
  cookie:
    - <первый_секрет_32_символа>
  cipher:
    - <второй_секрет_32_символа>
```

### 3.4 Коммит

```bash
git add .env.yc kratos/kratos.yc.yml nginx/nginx.yc.conf client/src/index.html
git commit -m "chore: configure for deployment"
```

---

## 4. Этап 1: Настройка ВМ

Выполняется **на ВМ** через SSH. Используйте команду подключения из Yandex Cloud (пример):

```bash
ssh -i <путь_к_ключу> <пользователь>@<IP_ВМ>
```

### 4.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 4.2 Установка Docker (официальный репозиторий)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

> **Важно:** после `usermod -aG docker` нужно выйти из SSH и зайти заново, чтобы группа `docker` применилась.

**Проверка:**
```bash
docker --version        # Docker version 29.x
docker compose version   # Docker Compose version v5.x
```

### 4.3 Установка Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Проверка:**
```bash
node --version   # v22.x
npm --version    # 10.x
```

### 4.4 Swap (рекомендовано для ВМ с 4 GB RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Проверка:**
```bash
free -h | grep Swap   # Должен показать 2.0Gi
```

---

## 5. Этап 2: Перенос проекта и сборка

### 5.1 Перенос репозитория на ВМ

**Вариант А — через SCP с локальной машины:**

```bash
# На локальной машине: упаковать проект (исключая node_modules, dist, .git)
tar -czf industrial-telemetry.tar.gz \
  --exclude=node_modules --exclude=dist --exclude=.angular \
  --exclude=.idea --exclude=.git \
  -C <путь_к_проекту> industrial-telemetry

# Скопировать на ВМ
scp -i <путь_к_ключу> industrial-telemetry.tar.gz <пользователь>@<IP_ВМ>:~/

# На ВМ: распаковать
cd ~
tar -xzf industrial-telemetry.tar.gz
rm industrial-telemetry.tar.gz
```

**Вариант Б — через git clone (если репозиторий публичный или настроен Deploy Key):**

```bash
cd ~
git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry
```

### 5.2 Установка зависимостей

```bash
cd ~/industrial-telemetry/server
npm ci

cd ~/industrial-telemetry/client
npm ci --legacy-peer-deps
```

### 5.3 Сборка

```bash
# Клиент (Angular PWA)
cd ~/industrial-telemetry/client
npm run build
# Результат: client/dist/browser/

# Сервер (TypeScript → JS)
cd ~/industrial-telemetry/server
npm run build
# Результат: server/dist/
```

**Проверка:**
```bash
ls ~/industrial-telemetry/client/dist/browser/   # 15–25 файлов
ls ~/industrial-telemetry/server/dist/server/src/  # index.js, routes/, services/, ...
```

---

## 6. Этап 3: Конфигурация .env.yc

Файл `.env.yc` уже должен быть в корне проекта (перенесён вместе с архивом).  
Убедитесь, что он содержит правильные значения:

```bash
cat ~/industrial-telemetry/.env.yc
```

Ожидаемое содержимое:
```ini
APP_URL=http://<ВАШ_IP_ИЛИ_ДОМЕН>
CORS_ORIGIN=http://<ВАШ_IP_ИЛИ_ДОМЕН>
MQTT_USERNAME=
MQTT_PASSWORD=
```

Docker Compose автоматически загружает файл `.env` из директории проекта.  
Если ваш файл называется `.env.yc`, скопируйте его:

```bash
cp ~/industrial-telemetry/.env.yc ~/industrial-telemetry/.env
```

---

## 7. Этап 4: Запуск Docker-стека

```bash
cd ~/industrial-telemetry
```

### 7.1 Сборка образов

```bash
docker compose -f docker-compose.yc.yml build --no-cache
```

Собирается образ `industrial-telemetry-server`. Остальные образы (`postgres`, `kratos`, `mosquitto`, `nginx`) скачиваются из Docker Hub (~500 MB, 5–10 минут при первом запуске).

### 7.2 Запуск

```bash
docker compose -f docker-compose.yc.yml up -d
```

Порядок автоматического запуска (благодаря `depends_on` + `healthcheck`):
1. `it-kratos-db` (PostgreSQL) — ждёт `pg_isready`
2. `it-kratos-migrate` — применяет SQL-миграции и завершается
3. `it-mosquitto` — MQTT-брокер
4. `it-kratos` — Identity Provider
5. `it-server` — Express API
6. `it-nginx` — Reverse proxy (порты 80 и 443)

### 7.3 Проверка статуса

```bash
docker compose -f docker-compose.yc.yml ps
```

**Ожидаемый вывод:** 5 контейнеров `Up` (healthy), 1 контейнер `Exited (0)` (kratos-migrate).

```
NAME           STATUS
it-nginx       Up
it-server      Up (healthy)
it-kratos      Up (healthy)
it-kratos-db   Up (healthy)
it-mosquitto   Up (healthy)
```

### 7.4 Просмотр логов

```bash
# Все контейнеры
docker compose -f docker-compose.yc.yml logs -f

# Конкретный
docker logs it-kratos
docker logs it-server
```

---

## 8. Этап 5: Открытие портов

Убедитесь, что порты 80 (HTTP) и 443 (HTTPS) открыты в Security Group Yandex Cloud:

```bash
# Проверить текущие правила
yc vpc security-group list

# Добавить правило для порта 80
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=80,protocol=tcp,v4-cidrs=0.0.0.0/0

# Порт 443
yc vpc security-group update-rules <sg-id> \
  --add-rule direction=ingress,port=443,protocol=tcp,v4-cidrs=0.0.0.0/0
```

Если ВМ создана без Security Group на уровне ОС (iptables не настроен), порты уже открыты.

---

## 9. Этап 6: Настройка DNS и домена

### Если используется домен

1. Зайти в личный кабинет регистратора (например, REG.RU)
2. Найти домен → «Управление DNS-зоной»
3. Найти A-запись для `@` (или имени домена)
4. Заменить IP на внешний IP ВМ
5. Сохранить изменения
6. Подождать распространения DNS (15–60 минут, до 24 часов)

**Проверка:**
```bash
nslookup <ваш_домен>
# Должен показать IP ВМ
```

### Если домена нет

Приложение доступно напрямую по IP: `http://<IP_ВМ>/`

---

## 10. Этап 7: Верификация

### 10.1 Проверка эндпоинтов

```bash
# Health-check сервера
curl http://<IP_ИЛИ_ДОМЕН>/api/health
# → {"success":true,"data":{"status":"healthy","mqtt":"connected"}}

# Health-check Kratos
curl http://<IP_ИЛИ_ДОМЕН>/.ory/health/alive
# → {"status":"ok"}

# Angular SPA
curl -s http://<IP_ИЛИ_ДОМЕН>/ | head -3
# → <!doctype html><html lang="ru"...
```

### 10.2 End-to-end: регистрация пользователя

1. Открыть `http://<IP_ИЛИ_ДОМЕН>/` в браузере
2. Нажать «Регистрация»
3. Заполнить: email, username, пароль (2 раза)
4. Нажать «Зарегистрироваться»
5. После успешной регистрации — редирект на `/dashboard`

### 10.3 Проверка MQTT

```bash
# Подписаться на все топики (изнутри ВМ)
docker exec it-mosquitto mosquitto_sub -t '#' -C 1 -W 3

# Опубликовать тестовое сообщение
docker exec it-mosquitto mosquitto_pub -t 'industrial/test' -m 'hello'
```

---

## 11. Устранение неполадок

### Kratos не стартует (unhealthy)

```bash
docker logs it-kratos --tail 30
```

**Частая ошибка:** `length must be <= 32` — секреты `cookie`/`cipher` длиннее 32 символов.  
Сгенерировать новые по 32 символа и обновить `kratos/kratos.yc.yml`.

### APP_URL не определён

Docker Compose не читает `.env.yc` — нужно скопировать в `.env`:

```bash
cp .env.yc .env
```

### Nginx возвращает 502

```bash
docker logs it-server --tail 20
docker logs it-kratos --tail 20
```

Вероятно, server или kratos не запустились.

### Полный сброс и перезапуск

```bash
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml down -v   # Удалит ВСЕ данные (БД, MQTT)
docker compose -f docker-compose.yc.yml up -d
```

### Перезапуск одного контейнера

```bash
docker restart it-kratos
docker restart it-server
```

---

## 12. Откат изменений

### Локальный откат конфигов

```bash
git checkout before-stage-0   # Вернуться к состоянию до всех правок
```

### Откат на ВМ

```bash
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml down -v   # Остановить и удалить данные
rm -rf ~/industrial-telemetry                      # Удалить проект
```

После этого — повторить Этапы 2–4 с исправленными конфигами.

---

## 13. Обслуживание

### Обновление приложения

```bash
cd ~/industrial-telemetry

# 1. Получить новые изменения (git pull или новый архив)
git pull   # или scp новый архив

# 2. Пересобрать
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
cd server && npm ci && npm run build && cd ..

# 3. Пересобрать образы и перезапустить
docker compose -f docker-compose.yc.yml build --no-cache
docker compose -f docker-compose.yc.yml up -d
```

### Мониторинг

```bash
# Статус контейнеров
docker ps --format "table {{.Names}}\t{{.Status}}"

# Использование ресурсов
docker stats --no-stream

# Место на диске
df -h /
```

### Бэкап

```bash
# Бэкап БД Kratos
docker exec it-kratos-db pg_dump -U kratos kratos > kratos-backup-$(date +%Y%m%d).sql

# Скопировать на локальную машину
scp -i <ключ> <пользователь>@<IP_ВМ>:~/kratos-backup-*.sql .
```

---

## Краткая шпаргалка команд

```bash
# ── Подключение ──
ssh -i <ключ> <пользователь>@<IP_ВМ>

# ── Статус ──
cd ~/industrial-telemetry
docker compose -f docker-compose.yc.yml ps
docker compose -f docker-compose.yc.yml logs --tail=30

# ── Перезапуск ──
docker compose -f docker-compose.yc.yml restart

# ── Остановка ──
docker compose -f docker-compose.yc.yml down          # Сохранить данные
docker compose -f docker-compose.yc.yml down -v       # Удалить всё

# ── Проверка ──
curl http://localhost/api/health
curl http://localhost/.ory/health/alive
```
