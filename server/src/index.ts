import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { mqttService } from './services/mqtt.service.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import usersRouter from './routes/users.routes.js';
import mqttRouter from './routes/mqtt.routes.js';

const app = express();

// --------------- Middleware ---------------
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true }));
app.use(express.json());

// --------------- Health-check ---------------
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      mqtt: mqttService.isConnected() ? 'connected' : 'disconnected',
    },
  });
});

// --------------- Routes ---------------
app.use('/api/users', usersRouter);
app.use('/api/mqtt', mqttRouter);

// --------------- Error handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

// --------------- Startup ---------------
async function bootstrap(): Promise<void> {
  // Express — стартует немедленно
  app.listen(config.port, () => {
    console.log(`[Server] Industrial Telemetry API запущен на порту ${config.port}`);
  });

  // MongoDB — фоновая попытка подключения
  mongoose
    .connect(config.mongo.uri)
    .then(() => console.log(`[MongoDB] Подключена: ${config.mongo.uri}`))
    .catch((err) => console.warn(`[MongoDB] Недоступна (${err.message}) — сервер работает, БД отключена`));

  // MQTT — фоновая попытка подключения
  mqttService
    .connect()
    .then(() => {
      mqttService.subscribe('sensors/#', (topic, payload) => {
        console.log(`[Telemetry] ${topic} → ${payload.toString()}`);
      });
    })
    .catch((err) => console.warn(`[MQTT] Недоступен (${err.message}) — сервер работает, MQTT отключён`));
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Получен ${signal}, graceful shutdown...`);
  await mqttService.disconnect();
  await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();

export default app;
