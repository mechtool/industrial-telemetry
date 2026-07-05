import { Router, Request, Response } from 'express';
import { mqttService } from '../services/mqtt.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/mqtt/status — статус MQTT-подключения
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        connected: mqttService.isConnected(),
        subscriptions: mqttService.getSubscriptions(),
      },
    });
  }),
);

// GET /api/mqtt/subscriptions — список активных подписок
router.get(
  '/subscriptions',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: mqttService.getSubscriptions(),
    });
  }),
);

// POST /api/mqtt/subscribe — подписаться на топик
router.post(
  '/subscribe',
  asyncHandler(async (req: Request, res: Response) => {
    const { topic } = req.body;
    if (!topic) {
      res.status(400).json({ success: false, error: { message: 'topic обязателен' } });
      return;
    }

    // Автоматический обработчик для логирования
    mqttService.subscribe(topic, (_t, payload) => {
      console.log(`[MQTT:${topic}] ${payload.toString()}`);
    });

    res.json({
      success: true,
      data: { topic, subscriptions: mqttService.getSubscriptions() },
    });
  }),
);

// POST /api/mqtt/unsubscribe — отписаться от топика
router.post(
  '/unsubscribe',
  asyncHandler(async (req: Request, res: Response) => {
    const { topic } = req.body;
    if (!topic) {
      res.status(400).json({ success: false, error: { message: 'topic обязателен' } });
      return;
    }

    mqttService.unsubscribe(topic);

    res.json({
      success: true,
      data: { topic, subscriptions: mqttService.getSubscriptions() },
    });
  }),
);

// POST /api/mqtt/publish — опубликовать сообщение
router.post(
  '/publish',
  asyncHandler(async (req: Request, res: Response) => {
    const { topic, message } = req.body;
    if (!topic || message === undefined) {
      res.status(400).json({
        success: false,
        error: { message: 'topic и message обязательны' },
      });
      return;
    }

    await mqttService.publish(topic, message);

    res.json({
      success: true,
      data: { topic, message },
    });
  }),
);

export default router;
