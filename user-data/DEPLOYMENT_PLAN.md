# План развёртывания Industrial Telemetry

**Дата плана:** 2026-09-27
**Цель:** развернуть и поддерживать Production-стек на Yandex Cloud VM
**ВМ:** Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD
**DNS:** industrial-telemetry.ru
**Репозиторий:** https://github.com/mechtool/industrial-telemetry.git (публичный, ветка `master`)

> Детальная пошаговая инструкция — `user-data/DEPLOYMENT_GUIDE.md`, ежедневная эксплуатация — `user-data/MANUAL_RUN_GUIDE.md`.

---

## Текущий статус компонентов

| Компонент | Статус | Комментарий |
|---|---|---|
| PostgreSQL 16 (Kratos + Keto) | ✅ Готов | Две базы: `kratos`, `keto` (БД `keto` создаётся `keto/init-keto.sql`) |
| Ory Kratos v1.3.1 (Auth) | ✅ Готов | Регистрация, логин, recovery (link-based), webhook на регистрацию |
| Ory Keto v0.14.0 (RBAC) | ✅ Готов | Роли admin/engineer/operator/viewer в relation tuples (namespace `Role`) |
| Mosquitto MQTT | ✅ Готов | Топик `industrial/sensors/#`, `allow_anonymous true` (к доработке) |
| Express API Server | ✅ Готов | Health, Kratos-прокси, Keto-клиент, MQTT-мост, users/settings/projects |
| Angular 22 PWA (NG-ZORRO) | ✅ Готов | Dashboard, MQTT, проекты, пользователи, настройки, профиль |
| Nginx | ✅ Готов | Reverse proxy, статика, security headers, rate limiting |
| Let's Encrypt HTTPS | ✅ Готов | Сертификаты монтируются, автообновление certbot (profile `ssl`) |

> ⚠️ Известное ограничение: поресурсные права Keto не включены — авторизация сейчас по ролям через `requireAdmin`, а не по разрешениям на ресурсы (`user-data/NEXT_STEPS.md`). Данные проектов и настроек — in-memory заглушки.

---

## Порядок деплоя (быстрый)

```bash
# 1. Подключиться
ssh -i <ключ> mit-2@<IP_ВМ>

# 2. Клонировать репозиторий (первый раз)
cd ~ && git clone https://github.com/mechtool/industrial-telemetry.git
cd industrial-telemetry

# 3. Создать реальные конфиги из шаблонов
cp .env.yc.example .env.yc
cp kratos/kratos.yc.example.yml kratos/kratos.yc.yml
#   .env.yc:        DOMAIN, DB_PASSWORD, MQTT_USERNAME, MQTT_PASSWORD, WEBHOOK_SECRET
#   kratos.yc.yml:  secrets.cookie/cipher (32 hex), courier.smtp.connection_uri,
#                   web_hook.auth.config.value (= WEBHOOK_SECRET)

# 4. Миграция ролей (traits.role -> Keto) — ТОЛЬКО при обновлении старой инсталляции
#    (для свежего деплоя не нужна: роль viewer назначается webhook'ом)
cd server && npm run migrate:roles && cd ..

# 5. SSL-сертификат (один раз, до старта nginx)
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-www:/var/www/certbot -p 80:80 \
  certbot/certbot certonly --standalone --agree-tos \
  --email admin@industrial-telemetry.ru \
  -d industrial-telemetry.ru --non-interactive

# 6. Собрать и поднять стек
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d

# 7. Включить автообновление сертификатов
docker compose -f docker-compose.yc.yml --env-file .env.yc --profile ssl up -d certbot

# 8. Проверить
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
curl -s https://industrial-telemetry.ru/api/health
```

> ⚠️ Порядок важен: при обновлении старой инсталляции миграцию `migrate:roles` выполнять **до** перезапуска `it-server`. Kratos не перечитывает конфиг на лету — после правки `kratos.yc.yml` выполнить `up -d kratos`.

---

## Проверка после деплоя

- [ ] `https://industrial-telemetry.ru/` — загружается Angular PWA
- [ ] `https://industrial-telemetry.ru/api/health` — `status: healthy`, `mqtt: connected`
- [ ] `/.ory/health/alive` — Kratos отвечает
- [ ] Регистрация нового пользователя → в Keto у него роль `viewer`
- [ ] Логин с созданным аккаунтом → редирект на `/projects`
- [ ] `/api/projects` возвращает стартовые проекты
- [ ] Дашборд показывает MQTT-статус
- [ ] Под админом: `/api/users` (список и смена ролей) работает
- [ ] Под админом: `/api/settings` (чтение и сохранение) работает
- [ ] Logout → редирект на логин
- [ ] Recovery flow (восстановление пароля через email)
- [ ] В логах Kratos webhook `Dispatching webhook` без `webhook failed`

---

## Роли и права (что проверять)

Роли хранятся в Keto (namespace `Role`, relation `member`), не в `traits.role`. У пользователя может быть несколько ролей.

| Роль | Видит Dashboard | Видит MQTT | Управляет пользователями | Меняет настройки |
|---|---|---|---|---|
| viewer (просмотр) | ✅ | ✅ | ❌ | ❌ |
| operator | ✅ | ✅ | ❌ | ❌ |
| engineer | ✅ (edit) | ✅ (edit) | ❌ | ✅ (edit) |
| admin | ✅ (полный) | ✅ (полный) | ✅ | ✅ |

> Роль `viewer` — низшая, назначается автоматически при регистрации. Enforcement сейчас по ролям (`requireAdmin` на `/api/users` и `PUT /api/settings`); поресурсная модель прав (`requirePermission`) не включена.

---

## Откат

Откат — по git-коммиту (`master`):

```bash
cd ~/industrial-telemetry
git log --oneline -5          # найти стабильный коммит
git checkout <commit>         # или git reset --hard <commit>
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
git checkout master           # вернуть ветку
```

Данные БД и сертификаты при откате сохраняются (Docker-тома + `/etc/letsencrypt`).
