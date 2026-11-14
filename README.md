# Industrial Telemetry (CRYOMON)

Платформа промышленного мониторинга холодильного оборудования: сбор телеметрии
с контроллеров **Danfoss AK-CC55** через шлюз **Waveshare RS485→Ethernet (MQTT+JSON)**,
хранение в PostgreSQL и веб-интерфейс на Angular.

## Стек

- **Клиент:** Angular 22 (PWA, NG-ZORRO, zoneless)
- **Сервер:** Express 4 (TypeScript ESM) + сервис-хранитель телеметрии `keeper`
- **Брокер:** Mosquitto (MQTT)
- **Auth/RBAC:** Ory Kratos v1.3.1 + Ory Keto v0.14.0
- **БД:** PostgreSQL 16 (Kratos / Keto / telemetry)
- **Инфраструктура:** Docker Compose (dev + prod), Nginx, Let's Encrypt

## Архитектура (кратко)

```
AK-CC55 ──RS485──► Waveshare (MQTT+JSON) ──MQTT──► Mosquitto
                                                      │
                              ┌───────────────────────┴───────────────┐
                              ▼                                       ▼
                    keeper (telemetry → Postgres)          Express API (Kratos/Keto/MQTT)
                                                                       │
                                                              Angular PWA (CRYOMON)
```

## Быстрый старт (локальная разработка)

```bash
npm run install:all                 # зависимости server + client

docker compose up -d                # PostgreSQL + Kratos + Keto + MailSlurper + Mosquitto
#   (первый запуск: cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml)
#   (рекомендуется: cp server/.env.example server/.env — SERVE_CLIENT=false, почта через MailSlurper)

cd server && npm run dev            # Express :3000
cd client && npm run start          # Angular :4200  → http://localhost:4200

# Телеметрия (опционально): схема + хранитель
docker compose --profile telemetry up -d telemetry-migrate keeper
```

## Документация

| Документ | Назначение |
|---|---|
| `user-data/MANUAL_RUN_GUIDE.md` | Запуск, эксплуатация, RBAC, устранение неполадок |
| `user-data/DEPLOYMENT_GUIDE.md` | Развёртывание в Yandex Cloud (пошагово) |
| `user-data/DEPLOYMENT_PLAN.md` | План развёртывания и статус компонентов |
| `user-data/DEV_STARTUP_NOTES.md` | Грабли dev-окружения |
| `user-data/NEXT_STEPS.md` | Текущее состояние и известные ограничения |
| `user-data/DEVELOPMENT_PLAN.md` | План дальнейшего развития приложения |
| `user-data/SEARCH_INFRASTRUCTURE_PLAN.md` | План поисковой инфраструктуры (Фаза 3) |
| `gateway/README.md` | Шлюз Waveshare MQTT+JSON: настройка, CSV-дизайн, грабли |

> Архивные заметки сессий — в `user-data/archive/`.

## Ключевые команды

```bash
# Корень
npm run dev:server | dev:client | build:server | build:client
docker compose up -d | down | ps | logs

# server/
npm run dev | build | start
npm run keeper:dev | keeper:start
npm run migrate:roles        # traits.role -> Keto (одноразовая, старые инсталляции)
npm run seed:presentation    # демо-пользователи презентации

# client/
npm run start | build | watch

# Prod (на ВМ)
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
```
