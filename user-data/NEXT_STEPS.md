# Industrial Telemetry — Дальнейшие шаги

**Дата:** 2026-08-02
**Текущая версия:** cf5674f (Keto RBAC интегрирован)

---

## ✅ Реализовано

### Аутентификация и авторизация
- [x] Ory Kratos — регистрация, логин, верификация email, восстановление пароля (link-based)
- [x] Ory Keto — ролевая модель (admin/engineer/operator), middleware `requirePermission`, `requireRole`
- [x] Keto seed при старте сервера (26 разрешений для 3 ролей на 5 ресурсов)
- [x] Angular `PermissionsService` — `canView`, `canEdit`, `canManageUsers`
- [x] Dashboard скрывает/показывает кнопки по правам

### Инфраструктура
- [x] Docker Compose (dev + YC production) — 8 контейнеров
- [x] Nginx reverse proxy с security headers (HSTS, X-Frame-Options, CSP, CORS)
- [x] Rate limiting (Kratos: 10 r/m, API: 30 r/m)
- [x] Let's Encrypt HTTPS (certbot автообновление каждые 12ч)
- [x] Health checks для всех контейнеров
- [x] Бэкап PostgreSQL (pg_dump Kratos + Keto)

### Клиент
- [x] Angular 22 PWA (service worker, manifest, иконки)
- [x] PrimeNG UI + PrimeFlex утилиты
- [x] Dashboard: MQTT-статус, пользователь, топики
- [x] MQTT Telemetry: подписка/отписка/публикация
- [x] Responsive дизайн (card-grid)
- [x] WCAG AA контраст (primary #047857, text #4b5563)
- [x] CSP `connect-src 'self' http://localhost:* https: wss:`

### Сервер
- [x] Express + TypeScript (ESM)
- [x] Kratos-прокси (login, registration, recovery, verification)
- [x] Keto-клиент (`check`, `hasRole`, `assignRole`, `grantPermission`)
- [x] RBAC middleware (`requirePermission`, `requireRole`, `loadPermissions`)
- [x] MQTT-мост (подписка, публикация, статус)
- [x] Таймауты fetch (клиент 15с, сервер 10с)
- [x] Graceful shutdown (SIGINT/SIGTERM)

### Качество кода
- [x] Удалён мёртвый CSS (.status-indicator, mqtt-telemetry классы)
- [x] Удалён dead code (navItems, неиспользуемые методы KratosService, kratosOptional, adminUrl)
- [x] Удалены debug-логи из recovery handler
- [x] Пустая директория `server/src/models/` удалена
- [x] Лишняя зависимость `http-proxy-middleware` из корневого package.json удалена

---

## 🔒 Безопасность — рекомендуется

### Высокий приоритет
- [ ] **MQTT-аутентификация** — `mosquitto.conf`: `allow_anonymous false` + `password_file`
- [ ] **Kratos secrets в .env** — вынести cookie/cipher секреты из `kratos.yc.yml` в переменные окружения
- [ ] **SMTP-пароль в .env** — пароль приложения Яндекса не должен быть в Git
- [ ] **CSRF-защита Express** — middleware `csurf` или `lusca` для state-changing запросов
- [ ] **Helmet middleware** — HTTP-заголовки безопасности на уровне Express (дублирует Nginx)

### Средний приоритет
- [ ] **Логирование запросов** — `morgan` или `pino` для аудита API-вызовов
- [ ] **Ротация логов** — Docker `logging driver: json-file` с `max-size` и `max-file`
- [ ] **Secrets manager** — Yandex Lockbox для хранения секретов вне кодовой базы
- [ ] **Бэкап по расписанию** — cron-задача `pg_dump` ежедневно + копирование в Object Storage
- [ ] **Fail2Ban** — защита от брутфорса на уровне Nginx (логин Kratos)

### Низкий приоритет
- [ ] **Docker-образы без root** — `USER node` уже есть в `Dockerfile.server`, добавить в `Dockerfile.client`
- [ ] **Read-only файловая система** — `docker-compose: read_only: true` для stateless-контейнеров
- [ ] **Security scanning** — Trivy или Docker Scout для сканирования уязвимостей образов
- [ ] **Content Security Policy audit** — регулярная проверка CSP на соответствие актуальным угрозам

---

## 🚀 Модернизация — рекомендуется

### Мониторинг и наблюдаемость
- [ ] **Health dashboard** — Prometheus + Grafana для метрик контейнеров и приложения
- [ ] **Uptime monitoring** — Yandex Monitoring или внешний (UptimeRobot, BetterStack)
- [ ] **Error tracking** — Sentry для клиентских и серверных ошибок
- [ ] **MQTT-метрики** — Prometheus exporter для Mosquitto (кол-во сообщений, подписчиков)

### CI/CD
- [ ] **GitHub Actions** — автосборка и тесты при push в master
- [ ] **Автодеплой** — деплой на ВМ при успешном прохождении CI
- [ ] **Тесты** — unit (Jest), e2e (Playwright/Cypress)

### База данных
- [ ] **PostgreSQL-бэкап в Yandex Object Storage** — автоматическое копирование дампов
- [ ] **Миграции с версионированием** — Keto/Kratos миграции уже есть, добавить свои SQL-миграции

### Функциональность
- [ ] **Админ-панель управления пользователями** — CRUD пользователей, назначение ролей через UI
- [ ] **Аудит действий** — логирование кто/когда/что сделал (изменение ролей, доступ к MQTT)
- [ ] **Визуализация телеметрии** — графики (Chart.js/ECharts) для MQTT-данных на дашборде
- [ ] **Алерты** — уведомления при выходе датчиков за пределы (email/Telegram)
- [ ] **Мобильное PWA** — офлайн-режим через Service Worker (уже есть база, доделать)

---

## 📋 План ближайших спринтов

### Спринт 1 — Безопасность (2-3 дня)
1. MQTT-аутентификация
2. Kratos secrets в .env
3. Helmet + CSRF
4. Логирование запросов

### Спринт 2 — Мониторинг и CI/CD (3-4 дня)
1. GitHub Actions (сборка + тесты)
2. Sentry (ошибки)
3. Uptime-мониторинг
4. Docker-логи с ротацией

### Спринт 3 — Функциональность (4-5 дней)
1. Админ-панель (управление пользователями и ролями)
2. Визуализация телеметрии (графики)
3. Алерты по датчикам
4. Аудит действий

---

## 🔗 Полезные ссылки

- [Ory Kratos Docs](https://www.ory.sh/docs/kratos/ory-kratos-intro)
- [Ory Keto Docs](https://www.ory.sh/docs/keto/)
- [Yandex Cloud Security Groups](https://cloud.yandex.ru/docs/vpc/concepts/security-groups)
- [Yandex Lockbox](https://cloud.yandex.ru/docs/lockbox/)
- [Yandex Object Storage](https://cloud.yandex.ru/docs/storage/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
