/**
 * Сервис-хранитель телеметрии.
 *
 * Подписывается на MQTT-топики платформы, нормализует сообщения шлюза
 * (см. normalize.ts) и пишет их в таблицу telemetry (PostgreSQL).
 *
 * Работает как отдельный процесс/контейнер (см. server/src/keeper.ts):
 * Express-сервер платформы при этом не затрагивается.
 *
 * Свойства, важные для эксплуатации:
 *   - записи сериализованы (одна за другой) — Postgres не захлёбывается;
 *   - при недоступной БД сообщения копятся в очереди с ограничением
 *     и дозаписываются, когда БД вернётся;
 *   - health-check по HTTP отдаёт статистику и статус БД.
 */

import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { TelemetryRepository, type TelemetryRecord } from './repository.js';
import { normalizeGatewayMessage } from './normalize.js';
import type { KeeperConfig } from './types.js';

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RETRY_DRAIN_MS = 5_000;

export class TelemetryKeeperService {
  private client: MqttClient | null = null;
  private readonly repository: TelemetryRepository;
  private readonly queue: TelemetryRecord[] = [];
  private readonly topics: string[];
  private draining = false;
  private stopping = false;
  private backoffMs = RECONNECT_MIN_MS;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: KeeperConfig, private readonly log = console.log) {
    this.topics = config.topics.map((topic) => config.topicPrefix + topic);
    this.repository = new TelemetryRepository({
      connectionString: config.databaseUrl,
      maxConnections: config.maxConnections,
      log: (message) => console.warn(message),
    });
  }

  /** Проверяет БД, подключается к брокеру и подписывается на топики. */
  async start(): Promise<void> {
    await this.repository.verify();
    this.log('[БД] Соединение установлено, таблица telemetry найдена');

    const opts: IClientOptions = {
      clientId: this.config.clientId,
      clean: true,
      reconnectPeriod: 5_000,
      connectTimeout: 30_000,
    };
    if (this.config.username && this.config.password) {
      opts.username = this.config.username;
      opts.password = this.config.password;
    }

    this.client = mqtt.connect(this.config.brokerUrl, opts);

    this.client.on('connect', () => {
      this.log(`[MQTT] Подключён к ${this.config.brokerUrl}`);
      for (const topic of this.topics) {
        this.client!.subscribe(topic, { qos: this.config.qos }, (err) => {
          if (err) {
            console.error(`[MQTT] Ошибка подписки на ${topic}: ${err.message}`);
          } else {
            this.log(`[MQTT] Подписан на ${topic}`);
          }
        });
      }
    });

    this.client.on('message', (topic, payload) => this.onMessage(topic, payload));
    this.client.on('error', (err) => console.warn(`[MQTT] Ошибка: ${err.message}`));
    this.client.on('close', () => this.log('[MQTT] Соединение закрыто'));
    this.client.on('reconnect', () => this.log('[MQTT] Переподключение...'));

    this.retryTimer = setInterval(() => void this.drain(), RETRY_DRAIN_MS);
  }

  /** Снимок состояния для health-check. */
  snapshot(): Record<string, unknown> {
    return {
      status: 'ok',
      mqtt: this.client?.connected ? 'connected' : 'disconnected',
      database: this.repository.getStats(this.queue.length).lastError ? 'degraded' : 'ok',
      topics: this.topics,
      ...this.repository.getStats(this.queue.length),
    };
  }

  /** Graceful shutdown: дозаписать очередь, закрыть брокер и БД. */
  async stop(): Promise<void> {
    if (this.stopping) {
      return;
    }
    this.stopping = true;

    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }

    // Даём до 10 секунд дозаписать очередь.
    const deadline = Date.now() + 10_000;
    while (this.queue.length > 0 && Date.now() < deadline) {
      await this.drain();
      if (this.queue.length > 0) {
        await delay(200);
      }
    }
    if (this.queue.length > 0) {
      console.warn(`[Keeper] Не записано сообщений: ${this.queue.length}`);
    }

    if (this.client) {
      await new Promise<void>((resolve) => this.client!.end(false, {}, () => resolve()));
      this.client = null;
    }
    await this.repository.close();
    this.log('[Keeper] Остановлен');
  }

  /** Приём сообщения: нормализация → очередь → запись. */
  private onMessage(topic: string, payload: Buffer): void {
    const normalized = normalizeGatewayMessage(payload, this.config.deviceId);
    if (!normalized) {
      this.repository.countInvalid(`топик ${topic}, payload ${payload.length} б`);
      return;
    }

    if (this.queue.length >= this.config.maxQueue) {
      this.queue.shift(); // теряем самое старое, чтобы не расти бесконечно
      console.warn(
        `[Keeper] Очередь переполнена (${this.config.maxQueue}) — старейшее сообщение отброшено`,
      );
    }

    this.queue.push({
      ts: new Date(normalized.ts),
      device: normalized.device,
      topic,
      payload: normalized,
    });

    void this.drain();
  }

  /** Последовательная запись очереди (одна запись за другой). */
  private async drain(): Promise<void> {
    if (this.draining || this.stopping) {
      return;
    }
    this.draining = true;

    try {
      while (this.queue.length > 0) {
        const record = this.queue[0]!;
        try {
          await this.repository.insert(record);
          this.queue.shift();
          this.backoffMs = RECONNECT_MIN_MS;
        } catch (err) {
          const reason = (err as Error).message;
          this.repository.countFailed(reason);
          console.warn(
            `[БД] Запись не удалась: ${reason}. Повтор через ${this.backoffMs} мс, в очереди ${this.queue.length}`,
          );
          await delay(this.backoffMs);
          this.backoffMs = Math.min(this.backoffMs * 2, RECONNECT_MAX_MS);
          break;
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
