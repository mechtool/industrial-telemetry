# Запуск dev-окружения — почему сложно и как запускать

**Дата:** 2026-10-03
**Сверено с фактическим состоянием:** `docker compose config`, `git ls-files`, `docker ps -a`, порты, логи.

---

## Полный порядок запуска (что реально нужно)

1. **Docker-инфраструктура** — `docker compose up -d` (PostgreSQL + Kratos + Keto + MailSlurper).
2. **MQTT-брокер** — Mosquitto на `:1883` (⚠ в dev-compose его НЕТ — см. причину №2).
3. **Сервер** — `cd server && npm run dev` → Express на `:3000`.
4. **Клиент** — `cd client && npm run start` → Angular dev-server на `:4200` (proxy `/api` и `/.ory` → `:3000`).

---

## Причины «не запускается с первого раза»

### 1. Свежий клон: нет `kratos.docker.yml` и `.env` (главная)

`kratos/kratos.docker.yml`, `kratos/kratos.yc.yml`, `.env`, `.env.yc` — **не в git** (gitignored), в репозитории только `*.example`. Dev-compose монтирует `./kratos` и запускает Kratos с `kratos.docker.yml`; без него контейнер `kratos` падает на старте.

**Fix:** `cp kratos/kratos.docker.example.yml kratos/kratos.docker.yml` (и при необходимости `.env`).

### 2. В dev-compose нет Mosquitto

`docker compose config --services` отдаёт только: `kratos-db, keto-migrate, keto, kratos-migrate, kratos, mailslurper`. Брокера MQTT в dev-стеке нет, хотя сервер по умолчанию ходит на `mqtt://localhost:1883`.

Сейчас `:1883` «случайно» работает из-за остаточного контейнера `it-mosquitto` из prod `docker-compose.yc.yml`.

**Fix:** добавить сервис `mosquitto` в `docker-compose.yml`, либо явно поднимать `eclipse-mosquitto:2` с `mosquitto.conf`.

### 3. Два compose-файла с пересекающимися портами и разными префиксами

- dev (`docker-compose.yml`) → имена `telemetry-*`;
- prod (`docker-compose.yc.yml`) → имена `it-*`;
- оба маппят на хост `4433/4434`, `4466/4467`, `5432`, `1883`.

Результат — смешанное состояние: висят `mosquitto` (Exited), `it-mailslurper` (Exited), `it-mosquitto` (Up) рядом с dev-`telemetry-*`. При одновременном использовании — конфликты портов.

**Fix:** работать с одним файлом за раз; чистить `docker compose down` (для обоих) и `docker ps -a` от лишнего.

### 4. Порядок и зависимости: миграции + healthcheck

Kratos/Keto требуют one-shot миграций (`kratos-migrate`, `keto-migrate`) после готовности Postgres; серверы висят на `depends_on: service_healthy`. Если БД не стала healthy вовремя — циклические рестарты.

**Fix:** после `up` проверять `docker compose ps`: `kratos-db` = healthy, `*-migrate` = `Exited (0)`.

### 5. Первый запуск тянет образы (нужна сеть)

postgres ~420 MB, mailslurper ~987 MB, kratos/keto/mosquitto. При заблокированной сети `up` падает, если образов ещё нет локально.

**Fix:** `docker pull` при доступной сети до запуска.

### 6. (Среда агента) фоновые dev-процессы убиваются при завершении команды

`tsx watch` / `ng serve`, запущенные обычным `Start-Process`, гибнут вместе с завершением вызова оболочки (job object). Из-за этого «с первого раза» сервер/клиент поднимаются и тут же падают.

**Рабочий способ — Task Scheduler** (процессы отвязываются от job-объекта и переживают команду):

```powershell
schtasks /create /f /tn "it-dev-server" /sc once /st 00:00 `
  /tr "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File %TEMP%\it-run-server.ps1"
schtasks /run /tn "it-dev-server"
```

launcher-скрипты (`%TEMP%\it-run-server.ps1`, `%TEMP%\it-run-client.ps1`):

```powershell
Set-Location 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server'; npm.cmd run dev *> 'C:\Users\Saturn\WebstormProjects\industrial-telemetry\server-dev.log'
```

Docker-контейнеры при этом **не** убиваются — ими управляет Docker daemon, а не оболочка.

### 7. Мелочь: кодировка логов

При redirect через `cmd` русский текст в `server-dev.log` превращается в кракозябры (cp866). Косметика, на работу не влияет.

---

## Как остановить

```powershell
schtasks /end /tn it-dev-server;   schtasks /delete /tn it-dev-server /f
schtasks /end /tn it-dev-client;   schtasks /delete /tn it-dev-client /f
docker compose down   # dev (по желанию)
```

---

## Состояние на 2026-10-03 (после запуска)

- Docker dev: `telemetry-*` Up, `kratos-db` healthy; MQTT на `:1883` держит остаточный `it-mosquitto`.
- Server: `http://localhost:3000` → `/api/health` = `healthy`, `mqtt: connected`.
- Client: `http://localhost:4200` → HTTP 200, vite watch.
- Задачи: `it-dev-server`, `it-dev-client`; launcher-скрипты в `%TEMP%\it-run-*.ps1`.
