# Industrial Telemetry — Дальнейшие шаги

**Дата:** 2026-09-27
**Текущая версия:** `29820e8` (master)

> Актуальный список того, что уже работает, и что осталось сделать. Фактическое состояние сверено с кодом (`server/src`, `client/src`, `docker-compose*.yml`, `kratos/`, `keto/`, `nginx/`).

---

## ✅ Текущее состояние (реализовано и работает)

### Аутентификация и авторизация
- [x] Ory Kratos v1.3.1 — регистрация, логин, восстановление пароля (link-based), смена пароля (settings-флоу), logout.
- [x] Роли в **Ory Keto** (relation tuples, namespace `Role`): `admin`, `engineer`, `operator`, `viewer`.
- [x] Несколько ролей на пользователя (`roles: string[]`); `/api/session` отдаёт `roles`.
- [x] Автоназначение `viewer` при регистрации — Kratos webhook (`POST /api/webhooks/registration`) + синхронный fallback в `/api/kratos/registration`.
- [x] Webhook защищён общим секретом `WEBHOOK_SECRET` (заголовок `Authorization`).
- [x] Проверка по ролям: middleware `requireAdmin` (защита `/api/users` и `PUT /api/settings`).
- [x] Миграция `npm run migrate:roles` (idempotent) — перенос старых `traits.role` → Keto.

### Инфраструктура
- [x] Docker Compose: dev (`docker-compose.yml`) и prod Yandex Cloud (`docker-compose.yc.yml`).
- [x] Dev-инфраструктура: PostgreSQL + Kratos + Keto + MailSlurper.
- [x] Prod-стек: PostgreSQL + Kratos + Keto + Express + Mosquitto + Nginx/Angular + certbot (profile `ssl`).
- [x] Nginx reverse proxy с security-заголовками (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) и rate limiting (Kratos 10 r/m, API 30 r/m).
- [x] Let's Encrypt HTTPS (certbot, автообновление каждые 12 ч).
- [x] Health check БД и клиента; graceful shutdown сервера; таймауты fetch.

### Клиент (Angular 22, PWA)
- [x] Angular 22 + **NG-ZORRO** (не PrimeNG) + `@ant-design/icons-angular`; zoneless change detection.
- [x] PWA: service worker, manifest, иконки.
- [x] Разделы: вход/регистрация/recovery, dashboard (MQTT-статус), MQTT-телеметрия (подписка/отписка/публикация), проекты (список/создание), пользователи и роли (admin), настройки, профиль.
- [x] CSP через `<meta http-equiv="Content-Security-Policy">` в `client/src/index.html`.

### Сервер (Express 4, TypeScript ESM)
- [x] Kratos-прокси (login/registration/recovery) + публичный прокси `/.ory`.
- [x] Keto-клиент на REST (`check`, `hasRole`, `listRoles`, `assignRole`, `revokeRole`, `setRoles`, `grantPermission`, `seedDefaults`).
- [x] MQTT-мост (подписка, публикация, статус, wildcard-топики `+`/`#`, реконнект), префикс `industrial/`, подписка `sensors/#`.
- [x] Маршруты: `/api/health`, `/api/session`, `/api/mqtt/*`, `/api/projects`, `/api/users`, `/api/settings`, `/api/webhooks/*`, `/.ory/*`.

---

## ⚠️ Известные ограничения (технический долг)

### 1. Поресурсные права Keto не включены
- `ketoService.seedDefaults()` **не вызывается** при старте сервера — разрешения на ресурсы (`dashboard`, `mqtt`, `mqtt-topics`, `users`, `settings`) не сидятся.
- Middleware `requirePermission` / `requireRole` / `loadPermissions` существуют, но **не применены** к маршрутам; `/api/mqtt/*` защищён только `kratosAuth`.
- Маршрута `/api/permissions` на сервере **нет**; клиентский `PermissionsService.load()` ходит на несуществующий `/api/permissions`.
- `PermissionsService` внедрён в `dashboard.component.ts`, но **не используется** (фактически мёртвый код).

**Итог:** авторизация сейчас по ролям (`requireAdmin`), а не по разрешениям на ресурсы. Целевая модель описана в `MANUAL_RUN_GUIDE.md` §7.

**Что сделать:** вызвать `seedDefaults()` при старте, применить `requirePermission` к `/api/mqtt/*` (и, при необходимости, к `/api/projects`), добавить маршрут `/api/permissions` (или отдавать права в `/api/session`) и задействовать `PermissionsService` на клиенте — либо удалить его, если поресурсная модель не нужна.

### 2. Данные в памяти (без персистентности)
- `/api/projects` (`server/src/services/projects.service.ts`) — in-memory `Map`, 4 стартовых проекта на пользователя; теряются при перезапуске.
- `/api/settings` (`server/src/services/settings.service.ts`) — in-memory объект настроек.

**Что сделать:** таблицы `projects` (с `owner_id`) и `settings` в PostgreSQL + CRUD.

### 3. Нет клиентских route-guard'ов
- `client/src/app/app.routes.ts` не содержит guard'ов — навигация свободная, защита только на сервере (401 при отсутствии сессии).

**Что сделать:** `authGuard` (редирект на `/login`) и `adminGuard` для `/users`/`/settings`.

### 4. Несогласованность версии Keto
- `keto/keto.yml` объявляет `version: v0.14.0-alpha.0`, а compose использует образ `oryd/keto:v0.14.0`; заголовок файла говорит «v0.13».

**Что сделать:** привести `version` (и комментарии) в `keto/keto.yml` к `v0.14.0`.

---

## 🔒 Безопасность — рекомендуется

### Высокий приоритет
- [ ] **MQTT-аутентификация** — `mosquitto.conf`: `allow_anonymous false` + `password_file`.
- [ ] **Закрыть порты наружу** — в prod публикуются `it-kratos` (4433/4434) и `it-mosquitto` (1883); оставить только 80/443 (nginx), остальное — в security group ВМ.
- [ ] **Kratos secrets в переменные окружения** — вынести cookie/cipher из `kratos.yc.yml` (Kratos не подставляет `${VAR}` напрямую — потребуется генерация конфига из шаблона при деплое).
- [ ] **SMTP-пароль вне git** — пароль приложения Яндекса сейчас в `courier.smtp.connection_uri`.
- [ ] **CSRF-защита Express** — `csurf`/`lusca` для state-changing запросов (сейчас защита только через cookie + CORS).
- [ ] **Helmet** — HTTP-заголовки безопасности на уровне Express (дублирует Nginx).

### Средний приоритет
- [ ] **Логирование запросов** — `morgan`/`pino` для аудита API-вызовов.
- [ ] **Ротация логов** — `logging driver: json-file` с `max-size`/`max-file`.
- [ ] **Secrets manager** — Yandex Lockbox для хранения секретов вне кодовой базы.
- [ ] **Бэкап по расписанию** — ежедневный `pg_dump` Kratos + Keto + копирование в Object Storage.
- [ ] **Fail2Ban** — защита от брутфорса на уровне Nginx (логин Kratos).

### Низкий приоритет
- [ ] **Docker-образы без root** — `USER node` уже есть в `Dockerfile.server`; добавить в `Dockerfile.client` (nginx).
- [ ] **Read-only файловая система** — `read_only: true` для stateless-контейнеров.
- [ ] **Security scanning** — Trivy / Docker Scout для образов.
- [ ] **CSP-аудит** — регулярная проверка CSP (сейчас задан `<meta>` в `index.html`, а не заголовком Nginx).

---

## 🚀 Модернизация — рекомендуется

### Мониторинг и наблюдаемость
- [ ] **Health dashboard** — Prometheus + Grafana (метрики контейнеров и приложения).
- [ ] **Uptime monitoring** — Yandex Monitoring или внешний (UptimeRobot, BetterStack).
- [ ] **Error tracking** — Sentry (клиент + сервер).
- [ ] **MQTT-метрики** — Prometheus exporter для Mosquitto (сообщения, подписчики).

### CI/CD
- [ ] **GitHub Actions** — сборка и тесты при push в master.
- [ ] **Автодеплой** — деплой на ВМ при успешном CI.
- [ ] **Тесты** — unit (Jest), e2e (Playwright/Cypress).

### База данных
- [ ] **Персистентность проектов/настроек** — PostgreSQL вместо in-memory (см. «Известные ограничения»).
- [ ] **Миграции с версионированием** — собственные SQL-миграции (Keto/Kratos миграции уже есть).

### Функциональность
- [ ] **Админ-панель управления пользователями** — частично есть (`/users` со сменой ролей); добавить CRUD (создание/удаление/блокировка).
- [ ] **Аудит действий** — лог «кто/когда/что» (смена ролей, доступ к MQTT).
- [ ] **Визуализация телеметрии** — графики (Chart.js/ECharts) для MQTT-данных на дашборде.
- [ ] **Алерты** — уведомления при выходе датчиков за пределы (email/Telegram).
- [ ] **Мобильное PWA** — офлайн-режим через Service Worker (база есть, доделать).

---

## 📋 План ближайших спринтов

### Спринт 1 — Закрыть технический долг (2–3 дня)
1. Включить поресурсные права Keto: `seedDefaults()` при старте, `requirePermission` на `/api/mqtt/*`, маршрут `/api/permissions`, задействовать или удалить `PermissionsService`.
2. Привести `keto/keto.yml` `version` к `v0.14.0`.
3. Добавить `authGuard`/`adminGuard` в Angular.

### Спринт 2 — Безопасность (2–3 дня)
1. MQTT-аутентификация.
2. Закрыть лишние порты в prod.
3. Helmet + CSRF.
4. Логирование запросов + ротация логов.

### Спринт 3 — Персистентность и CI/CD (3–4 дня)
1. PostgreSQL-таблицы `projects` и `settings` вместо in-memory.
2. GitHub Actions (сборка + тесты).
3. Sentry и uptime-мониторинг.

### Спринт 4 — Функциональность (4–5 дней)
1. Расширить админ-панель (CRUD пользователей).
2. Визуализация телеметрии (графики).
3. Алерты по датчикам.
4. Аудит действий.

---

## 🔗 Полезные ссылки

- [Ory Kratos Docs](https://www.ory.sh/docs/kratos/ory-kratos-intro)
- [Ory Keto Docs](https://www.ory.sh/docs/keto/)
- [Yandex Cloud Security Groups](https://cloud.yandex.ru/docs/vpc/concepts/security-groups)
- [Yandex Lockbox](https://cloud.yandex.ru/docs/lockbox/)
- [Yandex Object Storage](https://cloud.yandex.ru/docs/storage/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
