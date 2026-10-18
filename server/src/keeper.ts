/**
 * Точка входа сервиса-хранителя телеметрии (отдельный процесс).
 *
 * Подписывается на MQTT, нормализует сообщения шлюза и пишет в PostgreSQL.
 * Запуск:
 *   node dist/src/keeper.js
 *   tsx src/keeper.ts      (dev)
 */

import http from 'node:http';
import { config } from './config/index.js';
import { TelemetryKeeperService } from './services/telemetry/keeper.service.js';

const keeper = new TelemetryKeeperService(config.keeper);

async function main(): Promise<void> {
  const topics = config.keeper.topics.map((topic) => config.keeper.topicPrefix + topic);

  console.log('Сервис-хранитель телеметрии');
  console.log(`  Брокер:  ${config.keeper.brokerUrl}`);
  console.log(`  Топики:  ${topics.join(', ')}`);
  console.log(`  БД:      ${maskDatabaseUrl(config.keeper.databaseUrl)}`);
  console.log(`  Health:  http://localhost:${config.keeper.healthPort}/health\n`);

  await keeper.start();

  const healthServer = startHealthServer(config.keeper.healthPort, () => keeper.snapshot());

  const shutdown = async (signal: string) => {
    console.log(`\n[Keeper] Получен ${signal}, завершение...`);
    healthServer.close();
    await keeper.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

/** Health-check: отдаёт JSON со статистикой. */
function startHealthServer(port: number, snapshot: () => Record<string, unknown>): http.Server {
  if (port === 0) {
    return http.createServer();
  }

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, data: snapshot() }, null, 2));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: { message: 'not found' } }));
  });

  server.listen(port, () => console.log(`[Health] Слушаю http://localhost:${port}/health`));
  return server;
}

/** Скрывает пароль в строке подключения для логов. */
function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');
}

main().catch((err) => {
  console.error('[Keeper] Фатальная ошибка:', err);
  process.exit(1);
});
