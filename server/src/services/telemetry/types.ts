/**
 * Типы слоя сохранения телеметрии.
 *
 * Шлюз Waveshare (прошивка MQTT+JSON) сам опрашивает регистры AK-CC55
 * и публикует плоский JSON в MQTT. Сервис-хранитель (keeper) подписывается,
 * нормализует сообщение и пишет в PostgreSQL.
 */

/** Ключи датчиков, по которым контроллер сообщает признак ошибки. */
export type SensorKey = 'pe' | 's2' | 's3' | 's4' | 's5';

export type ValueKind = 'temperature' | 'number' | 'boolean';

/** Одна точка телеметрии: соответствует JSON-ключу, который присылает шлюз. */
export interface RegisterPoint {
  /** Ключ в JSON шлюза и в нормализованном блоке values. */
  key: string;
  /** Датчик, к которому привязана точка (если датчик в ошибке — значение null). */
  sensor?: SensorKey;
  kind: ValueKind;
}

/** Аварии контроллера (суммарная и по датчикам). */
export interface TelemetryAlarms {
  /** Суммарная авария; null, если значение не пришло. */
  sum: boolean | null;
  pe: boolean;
  s2: boolean;
  s3: boolean;
  s4: boolean;
  s5: boolean;
  high_temp: boolean;
  low_temp: boolean;
}

/** Нормализованное сообщение телеметрии (то, что попадает в БД). */
export interface NormalizedTelemetry {
  /** Время измерения (ISO); берётся из шлюза, при отсутствии — время приёма. */
  ts: string;
  /** Идентификатор устройства. */
  device: string;
  /** Значения: число/boolean либо null, если датчика нет или значение недостоверно. */
  values: Record<string, number | boolean | null>;
  alarms: TelemetryAlarms;
  /** Сырой JSON шлюза целиком — для отладки формата. */
  raw: Record<string, unknown>;
}

/** Конфигурация сервиса-хранителя (собирается в config/index.ts из env). */
export interface KeeperConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  /** Префикс топиков, совпадающий с MQTT_TOPIC_PREFIX платформы. */
  topicPrefix: string;
  /** Шаблоны подписки без префикса. */
  topics: string[];
  qos: 0 | 1 | 2;
  /** Идентификатор устройства по умолчанию, если шлюз не передал свой. */
  deviceId: string;
  databaseUrl: string;
  maxConnections: number;
  maxQueue: number;
  healthPort: number;
}
