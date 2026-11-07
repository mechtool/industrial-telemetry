# План развёртывания Industrial Telemetry

**Дата плана:** 2026-11-07 (актуализировано под `master` HEAD `109b917`)
**Цель:** развернуть и поддерживать Production-стек на Yandex Cloud VM
**ВМ:** Ubuntu 24.04, 2 vCPU, 4 GB RAM, 20 GB SSD
**DNS:** industrial-telemetry.ru
**Репозиторий:** https://github.com/mechtool/industrial-telemetry.git (публичный, ветка `master`)

> Детальная пошаговая инструкция — `user-data/DEPLOYMENT_GUIDE.md`, ежедневная эксплуатация — `user-data/MANUAL_RUN_GUIDE.md`, план развития — `user-data/DEVELOPMENT_PLAN.md`.

---

## Текущий статус компонентов

| Компонент | Статус | Комментарий |
|---|---|---|
| PostgreSQL 16 (Kratos + Keto + telemetry) | ✅ Готов | Базы `kratos`, `keto` (создаётся `keto/init-keto.sql`), `telemetry` (создаётся миграцией) |
| Ory Kratos v1.3.1 (Auth) | ✅ Готов | Регистрация, логин, recovery (link-based), webhook на регистрацию; SMTP через env |
| Ory Keto v0.14.0 (RBAC) | ✅ Готов | Роли admin/engineer/operator/viewer (namespace `Role`); поресурсные права не включены |
| Mosquitto MQTT | ✅ Готов | Топик `industrial/sensors/#`, `allow_anonymous true` (к доработке) |
| Express API Server | ✅ Готов | Health, Kratos-прокси, Keto-клиент, MQTT-мост, users/settings/projects, DaData-адреса |
| Keeper (телеметрия) | ✅ Готов | MQTT → normalize (массив/плоский) → таблица `telemetry`; health `:3100` |
| Шлюз Waveshare (источник данных) | ✅ Готов | MQTT+JSON, публикует в `industrial/sensors/akcc55` напрямую (без сборщика) |
| Angular 22 PWA (NG-ZORRO) | ✅ Готов | CRYOMON: проекты + карточка проекта (вкладки), настройки, презентация возможностей |
| Nginx | ✅ Готов | Reverse proxy, статика, security headers, rate limiting |
| Let's Encrypt HTTPS | ✅ Готов | Сертификаты монтируются; автообновление — `scripts/renew-cert.sh` (webroot + reload nginx по cron) |

> ⚠️ Известные ограничения: поресурсные права Keto не включены (авторизация по ролям через `requireAdmin`); проекты/настройки — in-memory; API телеметрии нет (данные пишутся, но клиент их не показывает). См. `user-data/NEXT_STEPS.md` и `user-data/DEVELOPMENT_PLAN.md`.

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
#   .env.yc:        DOMAIN, DB_PASSWORD, MQTT_USERNAME, MQTT_PASSWORD, WEBHOOK_SECRET,
#                   DADATA_API_KEY, SMTP_URI
#   kratos.yc.yml:  secrets.cookie/cipher (32 hex), web_hook.auth.config.value (= WEBHOOK_SECRET)

# 4. Миграция ролей (traits.role -> Keto) — ТОЛЬКО при обновлении старой инсталляции
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

# 7. Включить автообновление сертификатов (webroot renew + reload nginx)
crontab -e
# добавить строку:
#   0 3,15 * * * /home/mit-2/industrial-telemetry/scripts/renew-cert.sh >> /home/mit-2/industrial-telemetry/renew-cert.log 2>&1

# 8. Проверить
docker compose -f docker-compose.yc.yml --env-file .env.yc ps
curl -s https://industrial-telemetry.ru/api/health
ssh yc-vm "curl -s http://localhost:3100/health"
```

> ⚠️ Порядок важен: при обновлении старой инсталляции миграцию `migrate:roles` выполнять **до** перезапуска `it-server`. Kratos не перечитывает конфиг на лету — после правки `kratos.yc.yml` выполнить `up -d kratos`.

---

## Проверка после деплоя

- [ ] `https://industrial-telemetry.ru/` — загружается Angular PWA
- [ ] `https://industrial-telemetry.ru/api/health` — `status: healthy`, `mqtt: connected`
- [ ] `/.ory/health/alive` — Kratos отвечает
- [ ] Регистрация нового пользователя → в Keto роль `viewer`
- [ ] Логин → главная «CRYOMON»
- [ ] `/api/projects` возвращает стартовые проекты
- [ ] Под админом: `/api/users` и `/api/settings` работают
- [ ] `it-keeper` Up, `:3100/health` → `mqtt: connected`, `database: ok`
- [ ] В таблице `telemetry` растут строки (если шлюз публикует)
- [ ] Logout → редирект на логин
- [ ] Recovery flow (восстановление пароля через email)
- [ ] В логах Kratos webhook `Dispatching webhook` без `webhook failed`

---

## Роли и права (что проверять)

Роли хранятся в Keto (namespace `Role`, relation `member`), не в `traits.role`. У пользователя может быть несколько ролей.

| Роль | Видит Dashboard | Видит MQTT | Управляет пользователями | Меняет настройки |
|---|---|---|---|---|
| viewer | ✅ | ✅ | ❌ | ❌ |
| operator | ✅ | ✅ | ❌ | ❌ |
| engineer | ✅ (edit) | ✅ (edit) | ❌ | ✅ (edit) |
| admin | ✅ (полный) | ✅ (полный) | ✅ | ✅ |

> Роль `viewer` — низшая, назначается автоматически при регистрации. Enforcement сейчас по ролям (`requireAdmin` на `/api/users` и `PUT /api/settings`); поресурсная модель (`requirePermission`) не включена.

---

## Откат

Откат — по git-коммиту (`master`):

```bash
cd ~/industrial-telemetry
git log --oneline -5
git checkout <commit>         # или git reset --hard <commit>
docker compose -f docker-compose.yc.yml --env-file .env.yc build
docker compose -f docker-compose.yc.yml --env-file .env.yc up -d
git checkout master
```

Данные БД и сертификаты при откате сохраняются (Docker-тома + `/etc/letsencrypt`).
