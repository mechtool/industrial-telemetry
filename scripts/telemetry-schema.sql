-- ========================================================
-- Слой сохранения телеметрии Industrial Telemetry
--
-- Идемпотентный скрипт: его можно применять повторно и на dev, и на prod.
-- Схема согласована в ПЕРЕДАЧА_КОНТЕКСТА.md §5.3: сырой JSON в JSONB,
-- «плоские» колонки добавим позже, когда формат устоится.
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
    'Сырая телеметрия из MQTT. payload — сообщение сборщика AK-CC55 целиком.';
COMMENT ON COLUMN telemetry.ts IS
    'Время приёма сообщения сервером-хранителем (не время измерения).';
COMMENT ON COLUMN telemetry.device IS
    'Идентификатор устройства из поля device сообщения, напр. akcc55-084B4081.';
