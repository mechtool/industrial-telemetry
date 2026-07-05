import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import path from 'node:path';
import { config } from './config/index.js';
import { mqttService } from './services/mqtt.service.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import usersRouter from './routes/users.routes.js';
import mqttRouter from './routes/mqtt.routes.js';

const app = express();

// --------------- Middleware ---------------
app.use(compression());
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: true }));
app.use(express.json());

// --------------- Static files (production client) ---------------
const clientDist = path.resolve(process.cwd(), '../client/dist/browser');
app.use(express.static(clientDist, {
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (/\.(js|css|woff2?|png|jpg|jpeg|gif|ico|svg|webp|webmanifest)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.html$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// --------------- Health-check ---------------
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'degraded',
      uptime: process.uptime(),
      mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      mqtt: mqttService.isConnected() ? 'connected' : 'disconnected',
    },
  });
});

// --------------- Routes ---------------
app.use('/api/users', usersRouter);
app.use('/api/mqtt', mqttRouter);

// --------------- SPA fallback ---------------
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDist, 'index.html'));
});

// --------------- Error handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

// --------------- Startup (non-blocking) ---------------
async function bootstrap(): Promise<void> {
  app.listen(config.port, () => {
    console.log(`[Server] Industrial Telemetry API + Client запущены на http://localhost:${config.port}`);
  });

  // MongoDB — non-blocking, server works without it
  mongoose
    .connect(config.mongo.uri)
    .then(() => console.log(`[MongoDB] Подключена: ${config.mongo.uri}`))
    .catch((err) => console.warn(`[MongoDB] Недоступна (${err.message}) — сервер работает без БД`));

  // MQTT — non-blocking, server works without it
  mqttService
    .connect()
    .then(() => {
      mqttService.subscribe('sensors/#', (topic, payload) => {
        console.log(`[Telemetry] ${topic} → ${payload.toString()}`);
      });
    })
    .catch((err) => console.warn(`[MQTT] Недоступен (${err.message}) — сервер работает без MQTT`));
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
