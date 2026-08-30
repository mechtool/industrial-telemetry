import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { config } from '../config/index.js';

type MessageHandler = (topic: string, payload: Buffer) => void;

/**
 * Проверяет, соответствует ли конкретный топик подписочному паттерну MQTT.
 * Поддерживает wildcard: `+` (один уровень) и `#` (любое число уровней, только в конце).
 */
function topicMatches(pattern: string, topic: string): boolean {
  const patternLevels = pattern.split('/');
  const topicLevels = topic.split('/');

  for (let i = 0; i < patternLevels.length; i++) {
    const p = patternLevels[i];
    if (p === '#') {
      // `#` совпадает с любым числом оставшихся уровней (включая ноль)
      return true;
    }
    if (i >= topicLevels.length) {
      return false;
    }
    if (p !== '+' && p !== topicLevels[i]) {
      return false;
    }
  }

  return patternLevels.length === topicLevels.length;
}

class MqttService {
  private client: MqttClient | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private subscribed = new Set<string>();

  connect(): Promise<void> {
    const opts: IClientOptions = {
      clientId: config.mqtt.clientId,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30_000,
    };

    if (config.mqtt.username && config.mqtt.password) {
      opts.username = config.mqtt.username;
      opts.password = config.mqtt.password;
    }

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(config.mqtt.brokerUrl, opts);

      this.client.on('connect', () => {
        console.log(`[MQTT] Подключён к ${config.mqtt.brokerUrl}`);
        // Переподписка на топики после реконнекта
        this.resubscribeAll();
        resolve();
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        for (const [pattern, topicHandlers] of this.handlers) {
          if (!topicMatches(pattern, topic)) {
            continue;
          }
          for (const handler of topicHandlers) {
            try {
              handler(topic, payload);
            } catch (err) {
              console.error(`[MQTT] Ошибка обработчика для ${topic}:`, err);
            }
          }
        }
      });

      this.client.on('error', (err: Error) => {
        console.error('[MQTT] Ошибка подключения:', err.message);
        reject(err);
      });

      this.client.on('close', () => {
        console.log('[MQTT] Соединение закрыто');
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] Переподключение...');
      });
    });
  }

  /** Подписаться на топик с опциональным обработчиком */
  subscribe(topic: string, handler?: MessageHandler): void {
    const fullTopic = config.mqtt.topicPrefix + topic;
    this.subscribed.add(fullTopic);

    if (handler) {
      const existing = this.handlers.get(fullTopic) ?? new Set();
      existing.add(handler);
      this.handlers.set(fullTopic, existing);
    }

    if (this.client?.connected) {
      this.client.subscribe(fullTopic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Ошибка подписки на ${fullTopic}:`, err.message);
        } else {
          console.log(`[MQTT] Подписан на ${fullTopic}`);
        }
      });
    }
  }

  /** Отписаться от топика */
  unsubscribe(topic: string): void {
    const fullTopic = config.mqtt.topicPrefix + topic;
    this.subscribed.delete(fullTopic);
    this.handlers.delete(fullTopic);

    if (this.client?.connected) {
      this.client.unsubscribe(fullTopic, undefined, (err) => {
        if (err) {
          console.error(`[MQTT] Ошибка отписки от ${fullTopic}:`, err.message);
        }
      });
    }
  }

  /** Опубликовать сообщение */
  publish(topic: string, message: string | Buffer | object): Promise<void> {
    const fullTopic = config.mqtt.topicPrefix + topic;
    const payload = typeof message === 'object' ? JSON.stringify(message) : message;

    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        return reject(new Error('MQTT-клиент не подключён'));
      }
      this.client.publish(fullTopic, payload, { qos: 1 }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /** Получить список активных подписок */
  getSubscriptions(): string[] {
    return [...this.subscribed];
  }

  /** Проверить, подключён ли клиент */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /** Graceful shutdown */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          console.log('[MQTT] Отключён');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private resubscribeAll(): void {
    for (const topic of this.subscribed) {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Ошибка переподписки на ${topic}:`, err.message);
        }
      });
    }
  }
}

// Синглтон
export const mqttService = new MqttService();
