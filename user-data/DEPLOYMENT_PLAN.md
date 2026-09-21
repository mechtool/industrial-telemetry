# План развёртывания Industrial Telemetry

**Дата плана:** 2026-08-02
**Цель:** развернуть Production-стек на Yandex Cloud VM
**ВМ:** Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD
**DNS:** industrial-telemetry.ru

---

## Текущий статус компонентов

| Компонент | Статус | Комментарий |
|---|---|---|
| PostgreSQL 16 (Kratos + Keto) | ✅ Готов | Две базы: `kratos`, `keto` |
| Ory Kratos v1.3.1 (Auth) | ✅ Готов | Регистрация, логин, recovery |
| Ory Keto v0.14 (RBAC) | ✅ Готов | Роли admin/engineer/operator, seed при старте |
| Mosquitto MQTT | ✅ Готов | Топик `industrial/sensors/#` |
| Express API Server | ✅ Готов | Health, прокси Kratos, Keto-клиент, MQTT-мост |
| Angular 22 PWA | ✅ Готов | Dashboard, MQTT, права через PermissionsService |
| Nginx | ✅ Готов | Reverse proxy, статика, security headers |
| Let's Encrypt HTTPS | ⚠️ Настроен | Сертификаты монтируются, автообновление |

---

## Порядок деплоя (быстрый)

```bash
# 1. Подключиться
ssh -i <ключ> mit-2@<IP_ВМ>

# 2. Обновить репозиторий
cd ~/industrial-telemetry && git pull

# 3. Задать общий секрет webhook (один раз, при первом выкате этой версии)
#    .env.yc: WEBHOOK_SECRET=<секрет>
#    kratos/kratos.yc.yml: web_hook.auth.config.value = <тот же секрет>

# 4. Собрать
cd client && npm ci --legacy-peer-deps && npm run build && cd ..
cd server && npm ci && npm run build && cd ..

# 5. Миграция ролей (traits.role -> Keto) — ДО перезапуска сервера
cd server && npm run migrate:roles && cd ..

# 6. Перезапустить (kratos подхватит новый конфиг с webhook)
docker compose -f docker-compose.yc.yml --env-file .env.yc build --no-cache
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d

# 7. Проверить
docker compose -f docker-compose.yc.yml ps
curl -s https://industrial-telemetry.ru/api/health
```

> ⚠️ Порядок важен: миграцию (`migrate:roles`) выполнять **до** перезапуска `it-server`, а `it-kratos` перезапустить с новым конфигом (`up -d`), так как Kratos не перечитывает конфиг на лету.

---

## Проверка после деплоя

- [ ] `https://industrial-telemetry.ru/` — загружается Angular PWA
- [ ] `https://industrial-telemetry.ru/api/health` — `{"status":"healthy"}`
- [ ] `/.ory/health/alive` — Kratos отвечает
- [ ] Регистрация нового пользователя → в Keto у него роль `viewer`
- [ ] Логин с созданным аккаунтом
- [ ] Дашборд показывает MQTT-статус
- [ ] В консоли: `GET /api/permissions` возвращает права
- [ ] Logout → редирект на логин
- [ ] Recovery flow (восстановление пароля через email)

---

## Роли и права (что проверять)

Роли хранятся в Keto (не в `traits.role`), у пользователя может быть несколько ролей.

| Роль | Видит Dashboard | Видит MQTT | Управляет пользователями |
|---|---|---|---|
| viewer (просмотр) | ✅ | ✅ | ❌ |
| operator | ✅ | ✅ | ❌ |
| engineer | ✅ (edit) | ✅ (edit) | ❌ |
| admin | ✅ (полный) | ✅ (полный) | ✅ |

> Роль `viewer` — самая низкая, назначается автоматически при регистрации.

---

## Откат

Ветка `2026-08-02` — снапшот с Keto RBAC интегрированным, клиент и сервер рабочие.

```bash
git checkout 2026-08-02
# Собрать и перезапустить по инструкции выше
```
