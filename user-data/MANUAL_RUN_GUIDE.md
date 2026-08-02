# Industrial Telemetry — Руководство по ручному запуску

**Версия:** 2.0
**Дата:** 2026-08-02
**Стек:** Angular 22 (PWA) + Express + MQTT (Mosquitto) + Ory Kratos + Ory Keto (RBAC) + PostgreSQL + Nginx

---

## Оглавление

1. [Архитектура](#1-архитектура)
2. [Требования](#2-требования)
3. [Вариант A: Полный Docker-стек](#3-вариант-a-полный-docker-стек)
4. [Вариант B: Гибридный (Docker для инфраструктуры + Node.js)](#4-вариант-b-гибридный)
5. [Вариант C: Yandex Cloud (продакшен)](#5-вариант-c-yandex-cloud-продакшен)
6. [Проверка работоспособности](#6-проверка-работоспособности)
7. [Устранение неполадок](#7-устранение-неполадок)
8. [Команды быстрого доступа](#8-команды-быстрого-доступа)

---

## 1. Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      Браузер пользователя                         │
│                   http://localhost:3000 (dev)                     │
│                https://industrial-telemetry.ru (prod)             │
└────┬──────────────┬──────────────────┬───────────────────────────┘
     │              │                  │
     ▼              ▼                  ▼
┌──────────┐ ┌───────────┐     ┌──────────────┐
│  Nginx   │ │ Express   │     │   Angular    │
│  :80/443 │◄┤ API       │     │   PWA        │
│  прокси  │ │ :3000     │     │  (статика)   │
└────┬─────┘ └──┬───┬────┘     └──────────────┘
     │          │   │
     │ /.ory    │   ├──► Keto :4466/4467  ← проверка прав (RBAC)
     ▼          │   │
┌─────────┐    │   └──► Mosquitto MQTT :1883
│ Kratos  │    │
│ :4433   │    │
└────┬────┘    │
     │         │
     ▼         ▼
┌──────────────────┐
│ PostgreSQL :5432  │
│ БД: kratos, keto │
└──────────────────┘
```

| Сервис | Порты | Назначение |
|---|---|---|
| PostgreSQL 16 | 5432 | База данных (Kratos + Keto) |
| Kratos Migrate | — | SQL-миграция (одноразовый) |
| Ory Kratos | 4433, 4434 | Identity Provider |
| Keto Migrate | — | SQL-миграция Keto (одноразовый) |
| Ory Keto | 4466, 4467 | Permission Server (RBAC) |
| Mosquitto MQTT | 1883, 9001 (WS) | MQTT-брокер |
| Express Server | 3000 | API: health, прокси, Keto-клиент, MQTT-мост |
| Nginx / Angular | 80, 443 (или 4000 dev) | Статика + reverse proxy |

### Сетевые зависимости

```
PostgreSQL ◄── Kratos Migrate ◄── Kratos
           ◄── Keto Migrate   ◄── Keto
Mosquitto  ◄── Express Server ◄── Nginx
Kratos     ◄── Express Server
Keto       ◄── Express Server (RBAC middleware)
```

---

## 2. Требования

| Инструмент | Версия | Проверка |
|---|---|---|
| Node.js | ≥ 22 LTS | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Docker | ≥ 27 | `docker --version` |
| Docker Compose | v2 (плагин) | `docker compose version` |

---

## 3. Вариант A: Полный Docker-стек

Все 8 сервисов в Docker. Подходит для демонстрации и тестирования.

```bash
cd ~/industrial-telemetry

# Собрать клиент (нужно перед docker compose)
cd client && npm ci --legacy-peer-deps && npm run build && cd ..

# Запустить стек
docker compose up -d

# Проверить
docker compose ps
# Должно быть: 6 Up, 2 Exited (миграции)
```

Открыть: **http://localhost:4000** (Nginx на порту 4000 в dev-режиме)

Остановка:
```bash
docker compose down        # сохранить данные
docker compose down -v     # удалить всё
```

---

## 4. Вариант B: Гибридный

Docker для инфраструктуры (PostgreSQL + Kratos + Keto + Mosquitto), Node.js для разработки Express + Angular.

### 4.1 Поднять инфраструктуру

```bash
docker compose up -d kratos-db kratos-migrate kratos keto-migrate keto mosquitto
```

### 4.2 Настроить окружение

Создать/проверить `server/.env`:

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

### 4.3 Запуск

```bash
# Терминал 1: сервер
cd server && npm ci && npm run dev

# Терминал 2: клиент (prod-сборка)
cd client && npm ci --legacy-peer-deps && npm run build
```

Открыть: **http://localhost:3000** (Express раздаёт статику при `SERVE_CLIENT=true`)

---

## 5. Вариант C: Yandex Cloud (продакшен)

См. полное руководство: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

Кратко:
```bash
ssh -i <ключ> mit-2@<IP_ВМ>
cd ~/industrial-telemetry && git pull
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
cd server && npm ci && npm run build && cd ..
docker compose -f docker-compose.yc.yml --env-file .env.yc build --no-cache
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```

---

## 6. Проверка работоспособности

| Endpoint | Ожидаемый ответ | Что проверяет |
|---|---|---|
| `GET /api/health` | `{"status":"healthy"}` | Express + MQTT |
| `GET /api/permissions` | `{"canViewDashboard":true,...}` | Keto RBAC |
| `GET /.ory/health/alive` | `{"status":"ok"}` | Kratos |
| `GET /` | Angular PWA (index.html) | Статика |
| `POST /api/kratos/registration` | `{"success":true}` | Регистрация |

### End-to-end

1. Открыть приложение в браузере
2. Зарегистрироваться: email + username + пароль
3. Редирект на `/dashboard`
4. Проверить консоль: `GET /api/permissions` → роль и права
5. Logout → редирект на `/login`
6. Recovery flow: «Забыли пароль?» → ввести email → письмо → новая ссылка → смена пароля

---

## 7. Устранение неполадок

| Симптом | Проверка | Решение |
|---|---|---|
| 502 Bad Gateway | `docker logs it-server` | Kratos/Keto не отвечает |
| 504 Gateway Timeout | `docker logs it-server` | Keto recovery fetch завис |
| 401 Unauthorized | Куки сессии | Перелогиниться |
| 403 Forbidden | `GET /api/permissions` | Проверить роль через Keto |
| Keto не стартует | `docker logs it-keto` | Проверить миграцию: `docker compose up keto-migrate` |
| MQTT не подключается | `docker logs it-mosquitto` | Проверить порт 1883 |

---

## 8. Команды быстрого доступа

```bash
# Статус всех контейнеров
docker compose ps

# Логи конкретного сервиса
docker logs it-kratos --tail=30
docker logs it-keto --tail=30
docker logs it-server --tail=30

# Перезапуск одного сервиса
docker compose restart server

# Полный перезапуск
docker compose down && docker compose up -d

# Сборка клиента
cd client && npm run build && cd ..

# Запуск сервера (dev)
cd server && npm run dev

# Проверка API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/permissions -H 'Cookie: ...'
```
