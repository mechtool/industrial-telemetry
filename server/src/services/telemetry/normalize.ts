/**
 * Нормализация сообщения шлюза Waveshare (MQTT+JSON).
 *
 * Шлюз отдаёт сырые значения регистров без бизнес-логики. Здесь выполняется
 * та логика достоверности, которую раньше делал сборщик (collector):
 *   - флаг ошибки датчика (Pe/S2/S3/S4/S5) → привязанные температуры = null;
 *   - температура вне физического диапазона −100…150 °C → null.
 *
 * Ключи JSON шлюза должны совпадать с ключами ниже. Настраиваются в
 * Vircom («Corresponding JSON keyword») и в gateway/akcc55-poll.json.
 */

import type {
  NormalizedTelemetry,
  RegisterPoint,
  SensorKey,
  TelemetryAlarms,
} from './types.js';

/** Датчики и порядок их флагов ошибок (ключи JSON шлюза). */
const SENSORS: readonly SensorKey[] = ['pe', 's2', 's3', 's4', 's5'];

/** Физически осмысленный диапазон температур холодильного оборудования, °C. */
export const TEMPERATURE_RANGE: readonly [number, number] = [-100, 150];

/**
 * Точки значений. Совпадают с таблицей регистров в gateway/akcc55-poll.json.
 * Аварии (alarm_sum / alarm_high_temp / alarm_low_temp) обрабатываются отдельно
 * и в values не попадают — как в прежней реализации.
 */
const POINTS: readonly RegisterPoint[] = [
  { key: 'setpoint', kind: 'temperature' },
  { key: 'diff', kind: 'number' },
  { key: 'main_switch', kind: 'boolean' },

  { key: 'air_temp', kind: 'temperature' },
  { key: 'evap_temp', kind: 'temperature', sensor: 'pe' },
  { key: 'food_temp', kind: 'temperature' },
  { key: 's2_temp', kind: 'temperature', sensor: 's2' },
  { key: 's3_temp', kind: 'temperature', sensor: 's3' },
  { key: 's4_temp', kind: 'temperature', sensor: 's4' },
  { key: 's5_temp', kind: 'temperature', sensor: 's5' },

  { key: 'reg_state', kind: 'number' },
  { key: 'eev_opening', kind: 'number' },
  { key: 'pwm_od', kind: 'number' },
];

/**
 * Разбирает и нормализует сообщение шлюза.
 * Возвращает null, если payload не является JSON-объектом с распознаваемыми полями.
 */
export function normalizeGatewayMessage(
  raw: Buffer | string,
  fallbackDevice: string,
): NormalizedTelemetry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Идентификатор устройства: шлюз может добавить device/id, иначе — дефолт из конфига.
  const device =
    (typeof obj.device === 'string' && obj.device.length > 0 && obj.device) ||
    (typeof obj.id === 'string' && obj.id.length > 0 && obj.id) ||
    fallbackDevice;

  // Флаги ошибок датчиков: ненулевое значение = датчик в ошибке.
  const faults = new Set<SensorKey>();
  for (const key of SENSORS) {
    const rawValue = toFiniteNumber(obj[key]);
    if (rawValue !== null && rawValue !== 0) {
      faults.add(key);
    }
  }

  const alarms: TelemetryAlarms = {
    sum: toBoolean(obj.alarm_sum),
    pe: faults.has('pe'),
    s2: faults.has('s2'),
    s3: faults.has('s3'),
    s4: faults.has('s4'),
    s5: faults.has('s5'),
    high_temp: toBoolean(obj.alarm_high_temp) ?? false,
    low_temp: toBoolean(obj.alarm_low_temp) ?? false,
  };

  const values: Record<string, number | boolean | null> = {};
  for (const point of POINTS) {
    const rawValue = toFiniteNumber(obj[point.key]);

    if (rawValue === null) {
      values[point.key] = null;
      continue;
    }
    if (point.sensor && faults.has(point.sensor)) {
      values[point.key] = null;
      continue;
    }
    if (point.kind === 'boolean') {
      values[point.key] = rawValue !== 0;
      continue;
    }
    if (
      point.kind === 'temperature' &&
      (rawValue < TEMPERATURE_RANGE[0] || rawValue > TEMPERATURE_RANGE[1])
    ) {
      values[point.key] = null;
      continue;
    }

    values[point.key] = rawValue;
  }

  return {
    ts: toTimestamp(obj) ?? new Date().toISOString(),
    device,
    values,
    alarms,
    raw: obj,
  };
}

/** Приводит поле к конечному числу; null, если поле отсутствует или не число. */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Приводит поле к boolean; null, если поле отсутствует или не число. */
function toBoolean(value: unknown): boolean | null {
  const n = toFiniteNumber(value);
  return n === null ? null : n !== 0;
}

/** Извлекает корректную ISO-метку времени из известных полей шлюза. */
function toTimestamp(obj: Record<string, unknown>): string | null {
  const candidate = obj.ts ?? obj.time ?? obj.timestamp;
  if (typeof candidate === 'string') {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return new Date(candidate).toISOString();
  }
  return null;
}
