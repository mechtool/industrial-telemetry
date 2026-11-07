# Industrial Telemetry — Текущее состояние и ограничения

**Дата:** 2026-11-07
**Ветка:** `master` (HEAD `109b917`, 2026-10-31)
**Статус:** документ сверен с фактическим кодом (`server/src`, `client/src`, `docker-compose*.yml`, `scripts/`, `gateway/`, `keto/`, `kratos/`).

> Подробный план дальнейшего развития — `user-data/DEVELOPMENT_PLAN.md`.
> Запуск и эксплуатация — `user-data/MANUAL_RUN_GUIDE.md`, прод-развёртывание — `user-data/DEPLOYMENT_GUIDE.md`, диагностика dev-окружения — `user-data/DEV_STARTUP_NOTES.md`.

---

## 1. Что реализовано и работает

### Аутентификация и авторизация
- [x] Ory Kratos v1.3.1 — регистрация, логин, восстановление пароля (link-based), смена пароля (settings-флоу), logout.
- [x] Роли в Ory Keto (namespace `Role`, relation `member`): `admin`, `engineer`, `operator`, `viewer`; у пользователя может быть несколько ролей.
- [x] Автоназначение `viewer` при регистрации: webhook Kratos (`POST /api/webhooks/registration`) + синхронный fallback в `/api/kratos/registration`; защита секретом `WEBHOOK_SECRET`.
- [x] Проверка по ролям: `requireAdmin` закрывает `GET /api/users`, `PUT /api/users/:id/roles`, `PUT /api/settings`.
- [x] Миграция `npm run migrate:roles` (идемпотентная) — перенос старых `traits.role` → Keto.

### Сервер (Express 4, TypeScript ESM)
- [x] Kratos-прокси (`/api/kratos/*`) + публичный прокси `/.ory/*`.
- [x] Keto-клиент на REST: `check`, `hasRole`, `listRoles`, `assignRole`, `revokeRole`, `setRoles`, `grantPermission`, `seedDefaults`.
- [x] MQTT-мост: подписка/публикация/статус, wildcard-топики `+`/`#`, реконнект; сервер слушает `sensors/#` (логирование).
- [x] DaData-прокси подсказок адресов РФ: `GET /api/address/suggest` (ключ `DADATA_API_KEY`).
- [x] Маршруты: `/api/health`, `/api/session`, `/api/kratos/*`, `/api/webhooks/*`, `/api/mqtt/*`, `/api/projects`, `/api/users`, `/api/settings`, `/api/address/*`, `/.ory/*`.

### Телеметрия (шлюз → MQTT → PostgreSQL)
- [x] Источник данных — шлюз Waveshare RS485→Ethernet (прошивка MQTT+JSON), который **сам** опрашивает контроллеры Danfoss AK-CC55 и публикует JSON в `industrial/sensors/akcc55`. Отдельного сборщика на компьютере больше нет.
- [x] Сервис-хранитель `keeper` (отдельный процесс, `server/src/keeper.ts`): подписка `sensors/#`, нормализация (`server/src/services/telemetry/normalize.ts`), запись в таблицу `telemetry`.
- [x] Поддержка двух форматов шлюза: массив `{"controllers":[...]}` (текущий) и плоский объект (старый); флаг ошибки датчика → `null`, температура вне −100…150 °C → `null`.
- [x] Схема БД `scripts/telemetry-schema.sql`; health-check `:3100/health`; дизайн шлюза и CSV-генератор — в `gateway/`.

### Клиент (Angular 22, NG-ZORRO, zoneless, PWA)
- [x] PWA (service worker, manifest, иконки); CSP через `<meta>` в `client/src/index.html`.
- [x] Аутентификация: `/login`, `/registration`, `/recovery`, `/link-sent`, `/change-password`.
- [x] Оболочка после входа (`authGuard`): главная «CRYOMON», раздел «Проекты» (список / плитки / пусто / карточка проекта), «Настройки»; профиль — модальное окно.
- [x] Карточка проекта `/projects/:id` с вкладками: Общие, Панель управления, Объекты, Данные, Шлюзы, Организации, Триггеры, Пользователи. Реализованы: Общие / Панель / Объекты / Шлюзы / Организации / Пользователи; «Данные» и «Триггеры» — заглушки.
- [x] Публичная презентация `/presentation` (`retail`, `service`) для демо-почт `service@telemetry.ru` и `retail@telemetry.ru` (пароль `presentation`), доступ через `presentationGuard`; сидинг — `npm run seed:presentation`.
- [x] `authGuard` на клиенте есть; `adminGuard` — нет (защита административных операций только на сервере через `requireAdmin`).

### Инфраструктура
- [x] Dev: `docker-compose.yml` — PostgreSQL + Kratos + Keto + MailSlurper + Mosquitto; профиль `telemetry` (миграция схемы + keeper).
- [x] Prod: `docker-compose.yc.yml` — PostgreSQL + Kratos + Keto + Express + Mosquitto + keeper + Nginx/Angular + certbot (profile `ssl`).
- [x] Nginx reverse proxy с security-заголовками (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) и rate limiting.
- [x] Let's Encrypt HTTPS (certbot); автообновление — `scripts/renew-cert.sh` (webroot renew + reload nginx по cron).

---

## 2. Известные ограничения / технический долг

### 2.1 Поресурсные права Keto не включены
- `ketoService.seedDefaults()` **не вызывается** при старте сервера — разрешения на ресурсы (`dashboard`, `mqtt`, `mqtt-topics`, `users`, `settings`) не сидятся.
- Middleware `requirePermission` / `requireRole` / `loadPermissions` существуют, но **не применены**; `/api/mqtt/*` защищён только `kratosAuth`.
- Маршрута `/api/permissions` на сервере **нет**; клиентский `PermissionsService` существует, но нигде не внедряется и ходит на несуществующий `/api/permissions` — мёртвый код.

**Итог:** авторизация сейчас по ролям (`requireAdmin`), а не по разрешениям на ресурсы.

### 2.2 Данные в памяти (без персистентности)
- `/api/projects` (`server/src/services/projects.service.ts`) — in-memory `Map`, 4 стартовых проекта на пользователя; теряются при перезапуске.
- `/api/settings` (`server/src/services/settings.service.ts`) — in-memory объект.
- Разделы «Объекты», «Шлюзы», «Организации», «Пользователи» внутри проекта — клиентские заготовки (`*-ui.service`), серверных моделей/эндпоинтов для них нет.

### 2.3 Телеметрия не доходит до клиента
- Данные пишутся в таблицу `telemetry` (PostgreSQL), но API телеметрии (`/api/telemetry/*`) **нет** — сайт эти данные не показывает. Вкладка «Данные» в проекте — заглушка.

### 2.4 Безопасность MQTT
- `mosquitto.conf` использует `allow_anonymous true`; порт 1883 открыт анонимно (осознанно, по решению заказчика — см. архивные заметки). Аутентификация/TLS не настроены.

### 2.5 Нет ретеншена телеметрии
- Таблица `telemetry` растёт безгранично (30 с ≈ 2 880 строк/сутки на устройство); политики хранения/очистки нет.

### 2.6 Клиентские заглушки и неиспользуемый код
- `client/src/app/services/projects-ui.service.ts` — захардкоженные счётчики фильтров (`18/7/3/6/2/0`), не считаются по данным.
- `client/src/app/services/permissions.service.ts` — мёртвый код (см. §2.1): не внедряется, ходит на несуществующий `/api/permissions`.
- Пункты меню «Пользователи», «Журналы», «Протоколы», «Чаты» в боковом меню — без маршрутов (заглушки).

### 2.7 Нет тестов и CI
- Unit/e2e-тесты отсутствуют, проверка выполнялась вручную смоук-тестами. CI/CD (GitHub Actions) не настроен.

### 2.8 Мелочи
- ~~`keto/keto.yml` объявлял `version: v0.14.0-alpha.0`~~ — исправлено на `v0.14.0`.
- В `server/.env` и корневых `.env*` — локальные значения; они gitignored и в репозиторий не входят.

---

## 3. Что делать дальше

Полный пофазный план с критериями готовности — в `user-data/DEVELOPMENT_PLAN.md`. Кратко, по приоритету:

1. **Телеметрия end-to-end**: API `/api/telemetry/*` (devices/latest/history) и UI-визуализация.
2. **Безопасность MQTT**: `allow_anonymous false` + логин/пароль (+ TLS 8883), закрыть лишние порты наружу.
3. **Персистентность**: таблицы `projects`/`settings`/`objects`/`gateways`/`organizations` в PostgreSQL (см. `SEARCH_INFRASTRUCTURE_PLAN.md`).
4. **Поресурсные права Keto**: `seedDefaults()` при старте, `requirePermission` на маршрутах, `/api/permissions` (или права в `/api/session`) и довести `PermissionsService` до рабочего (или удалить, если поресурсная модель не нужна).
5. **Ретеншен и мониторинг**: политика хранения телеметрии, алерты «данные не идут N минут».
6. **Качество**: тесты, CI/CD, error tracking.
