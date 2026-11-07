# Запуск dev-окружения — порядок и грабли

**Дата:** 2026-10-31
**Сверено с:** `docker-compose.yml`, `server/package.json`, `client/package.json`, фактическое состояние.

---

## Полный порядок запуска (что реально нужно)

1. **Docker-инфраструктура** — `docker compose up -d` (PostgreSQL + Kratos + Keto + MailSlurper + Mosquitto).
2. **Сервер** — `cd server && npm run dev` → Express на `:3000`.
3. **Клиент** — `cd client && npm run start` → Angular dev-server на `:4200` (proxy `/api` и `/.ory` → `:3000`).
4. **(Опционально) Телеметрия** — `docker compose --profile telemetry up -d telemetry-migrate keeper` → health `:3100`.

---

## Грабли, которые уже встречались

### 1. Свежий клон: нет `kratos.docker.yml` и `.env`

`kratos/kratos.docker.yml`, `kratos/kratos.yc.yml`, `.env`, `.env.yc` — **не в git** (gitignored), в репозитории только `*.example`. Dev-compose монтирует `./kratos` и запускает Kratos с `kratos.docker.yml`; без него контейнер `kratos` падает.

**Fix:** `cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml` (и при необходимости `.env`).

### 2. Два compose-файла с пересекающимися портами

- dev (`docker-compose.yml`) → имена `telemetry-*`;
- prod (`docker-compose.yc.yml`) → имена `it-*`;
- оба маппят на хост `4433/4434`, `4466/4467`, `5432`, `1883`.

Одновременный запуск даёт конфликты портов. **Fix:** работать с одним файлом за раз; чистить `docker compose down` (для обоих) и `docker ps -a`.

### 3. Порядок и зависимости: миграции + healthcheck

Kratos/Keto требуют one-shot миграций (`kratos-migrate`, `keto-migrate`) после готовности Postgres; серверы висят на `depends_on: service_healthy`. Если БД не стала healthy вовремя — циклические рестарты.

**Fix:** после `up` проверять `docker compose ps`: `kratos-db` = healthy, `*-migrate` = `Exited (0)`.

### 4. Первый запуск тянет образы (нужна сеть)

postgres ~420 MB, mailslurper ~987 MB, kratos/keto/mosquitto. При заблокированной сети `up` падает, если образов нет локально. **Fix:** `docker pull` при доступной сети до запуска.

### 5. Фоновые dev-процессы убиваются при завершении оболочки (среда агента)

`tsx watch` / `ng serve`, запущенные обычным `Start-Process`, гибнут вместе с завершением вызова оболочки (job object).

**Рабочий способ — Task Scheduler** (процессы отвязываются от job-объекта):

```powershell
schtasks /create /f /tn "it-dev-server" /sc once /st 00:00 `
  /tr "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File %TEMP%\it-run-server.ps1"
schtasks /run /tn "it-dev-server"
```

launcher-скрипты (`%TEMP%\it-run-server.ps1`, `%TEMP%\it-run-client.ps1`):

```powershell
Set-Location 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server'; npm.cmd run dev *> 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server-dev.log'
```

Docker-контейнеры при этом **не** убиваются — ими управляет Docker daemon.

### 6. Мелочь: кодировка логов

При redirect через `cmd` русский текст в логах превращается в кракозябры (cp866). Косметика, на работу не влияет.

---

## Как остановить

```powershell
schtasks /end /tn it-dev-server;   schtasks /delete /tn it-dev-server /f
schtasks /end /tn it-dev-client;   schtasks /delete /tn it-dev-client /f
docker compose down   # dev (по желанию)
```

---

## Состояние на 2026-10-31 (перед консервацией)

- В dev-compose есть Mosquitto (порт 1883/9001) — отдельный контейнер больше не нужен.
- Телеметрия: профиль `telemetry` (миграция + keeper); схема — `scripts/telemetry-schema.sql`.
- Клиент — «CRYOMON» (проекты + карточка проекта), без разделов dashboard/mqtt-telemetry/users (удалены ранее).
- Заметки сессий перенесены в `user-data/archive/`; актуальная инструкция по шлюзу — `gateway/README.md`.
