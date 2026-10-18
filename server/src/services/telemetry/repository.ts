/**
 * Репозиторий телеметрии: запись сообщений в PostgreSQL.
 *
 * Схема (scripts/telemetry-schema.sql):
 *   telemetry(id, ts, device, topic, payload JSONB)
 *
 * В payload кладём нормализованное сообщение (values/alarms + raw).
 * Плоские device и ts вынесены отдельно для индексов и выборок.
 */

import { Pool, type PoolConfig } from 'pg';

export interface TelemetryRecord {
  /** Время измерения (из сообщения; при некорректном — время приёма). */
  ts: Date;
  device: string;
  topic: string;
  /** Нормализованное сообщение целиком. */
  payload: unknown;
}

export interface TelemetryRepositoryOptions {
  connectionString: string;
  /** Максимум соединений в пуле. */
  maxConnections: number;
  log?: (message: string) => void;
}

export interface TelemetryStats {
  /** Записано строк. */
  inserted: number;
  /** Сообщений, которые не удалось разобрать. */
  invalid: number;
  /** Сколько раз запись падала (уходит в повтор). */
  failed: number;
  /** Текущая длина очереди на запись. */
  queued: number;
  /** Последняя ошибка БД, если была. */
  lastError: string | null;
}

export class TelemetryRepository {
  private readonly pool: Pool;
  private readonly log: (message: string) => void;
  private readonly stats: TelemetryStats = {
    inserted: 0,
    invalid: 0,
    failed: 0,
    queued: 0,
    lastError: null,
  };

  constructor(options: TelemetryRepositoryOptions) {
    const poolConfig: PoolConfig = {
      connectionString: options.connectionString,
      max: options.maxConnections,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    };

    this.pool = new Pool(poolConfig);
    this.log = options.log ?? (() => {});

    // Ошибка простаивающего соединения не должна ронять процесс.
    this.pool.on('error', (err: Error) => {
      this.stats.lastError = err.message;
      this.log(`[БД] Ошибка простаивающего соединения: ${err.message}`);
    });
  }

  /** Проверка доступности БД и наличия таблицы на старте. */
  async verify(): Promise<void> {
    const { rows } = await this.pool.query<{ table_name: string | null }>(
      `SELECT to_regclass('public.telemetry')::text AS table_name`,
    );
    if (!rows[0]?.table_name) {
      throw new Error(
        'Таблица telemetry не найдена. Примените scripts/telemetry-schema.sql к целевой базе.',
      );
    }
  }

  /** Записать одно сообщение. Возвращает id строки. */
  async insert(record: TelemetryRecord): Promise<number> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO telemetry (ts, device, topic, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [record.ts, record.device, record.topic, JSON.stringify(record.payload)],
    );
    this.stats.inserted += 1;
    this.stats.lastError = null;
    return Number(rows[0]!.id);
  }

  /** Учесть сообщение, которое не удалось разобрать. */
  countInvalid(reason: string): void {
    this.stats.invalid += 1;
    this.log(`[Keeper] Некорректное сообщение: ${reason}`);
  }

  /** Учесть неудачную запись. */
  countFailed(reason: string): void {
    this.stats.failed += 1;
    this.stats.lastError = reason;
  }

  getStats(queued: number): TelemetryStats {
    this.stats.queued = queued;
    return { ...this.stats };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
