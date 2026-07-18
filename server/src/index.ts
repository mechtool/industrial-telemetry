import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import { config } from './config/index.js';
import { mqttService } from './services/mqtt.service.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { kratosAuth } from './middleware/kratos.middleware.js';
import kratosRouter from './routes/kratos.routes.js';
import mqttRouter from './routes/mqtt.routes.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// --------------- Middleware ---------------
app.use(compression());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());

// --------------- Static files (only when serving client from same host) ---------------
if (config.serveClient) {
  const clientDist = path.resolve(process.cwd(), '../client/dist/browser');
  console.log(`[Server] Раздача статики из ${clientDist}`);
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
}

// --------------- Health-check ---------------
app.get('/api/health', async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      mqtt: mqttService.isConnected() ? 'connected' : 'disconnected',
    },
  });
});

// --------------- Kratos session check ---------------
app.get('/api/session', kratosAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user!.id,
      email: req.user!.email,
      username: req.user!.username,
      role: req.user!.role,
      department: req.user!.department,
    },
  });
});

// --------------- Kratos proxy routes (login/registration API) ---------------
app.use('/api/kratos', kratosRouter);

// --------------- Routes ---------------
app.use('/api/mqtt', kratosAuth, mqttRouter);

// --------------- Kratos public proxy (/.ory → Kratos) ---------------
app.use('/.ory', createProxyMiddleware({
  target: config.kratos.publicUrl,
  changeOrigin: true,
  pathRewrite: { '^/.ory': '' },
}));

// --------------- SPA fallback (only when serving client) ---------------
if (config.serveClient) {
  const clientDist = path.resolve(process.cwd(), '../client/dist/browser');
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --------------- Error handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

// --------------- Startup (non-blocking) ---------------
async function bootstrap(): Promise<void> {
  app.listen(config.port, () => {
    console.log(`[Server] Industrial Telemetry API запущен на http://localhost:${config.port}`);
    console.log(`[Server] Kratos public: ${config.kratos.publicUrl}`);
  });

  // MQTT — non-blocking
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
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();

export default app;
