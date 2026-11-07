-- ========================================================
-- Слой сохранения телеметрии Industrial Telemetry
--
-- Идемпотентный скрипт: его можно применять повторно и на dev, и на prod.
-- Сырой JSON в JSONB; «плоские» колонки добавим позже, когда формат устоится.
-- Формат сообщения шлюза и нормализация — server/src/services/telemetry/normalize.ts,
-- инструкция по шлюзу — gateway/README.md.
--
-- Применение:
--   psql -U kratos -d telemetry -f telemetry-schema.sql
-- ========================================================

CREATE TABLE IF NOT EXISTS telemetry (
    id      BIGSERIAL   PRIMARY KEY,
    ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    device  TEXT        NOT NULL,
    topic   TEXT        NOT NULL,
    payload JSONB       NOT NULL
);

-- Основной запрос: последние показания по устройству.
CREATE INDEX IF NOT EXISTS telemetry_device_ts_idx
    ON telemetry (device, ts DESC);

-- Запрос «что пришло за период» без привязки к устройству.
CREATE INDEX IF NOT EXISTS telemetry_ts_idx
    ON telemetry (ts DESC);

COMMENT ON TABLE telemetry IS
    'Сырая телеметрия из MQTT. payload — нормализованное сообщение шлюза AK-CC55 (values/alarms + raw).';
COMMENT ON COLUMN telemetry.ts IS
    'Время измерения (из сообщения шлюза; при отсутствии — время приёма).';
COMMENT ON COLUMN telemetry.device IS
    'Идентификатор устройства из поля device сообщения, напр. akcc55-084B4081.';
