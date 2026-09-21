import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { ketoService, Roles } from '../services/keto.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

/**
 * Webhook от Ory Kratos: вызывается после успешной регистрации.
 * Назначает новому пользователю самую низкую роль — viewer (просмотр).
 *
 * Защита: если задан WEBHOOK_SECRET, запрос обязан прийти с
 * `Authorization: <WEBHOOK_SECRET>` (Kratos шлёт его через auth.api_key,
 * значение передаётся как есть, без префикса «Bearer»).
 * Без секрета (локальная разработка) проверка пропускается.
 */
router.post(
  '/registration',
  asyncHandler(async (req: Request, res: Response) => {
    if (config.webhook.secret) {
      if (req.headers.authorization !== config.webhook.secret) {
        console.warn('[Webhook] Запрос отклонён: неверный Authorization');
        res.status(401).json({ success: false, error: { message: 'Неверный webhook secret' } });
        return;
      }
    }

    const identityId = req.body?.identity_id;
    if (typeof identityId !== 'string' || !identityId) {
      res.status(400).json({ success: false, error: { message: 'identity_id обязателен' } });
      return;
    }

    const ok = await ketoService.assignRole(identityId, Roles.VIEWER);
    console.log(`[Webhook] registration ${ok ? 'OK' : 'FAILED'} → viewer (identity=${identityId})`);
    if (!ok) {
      res.status(502).json({ success: false, error: { message: 'Keto недоступен' } });
      return;
    }

    res.json({ success: true });
  }),
);

export default router;
