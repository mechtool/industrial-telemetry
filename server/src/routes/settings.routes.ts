import { Router, Request, Response } from 'express';
import { settingsService } from '../services/settings.service.js';
import { requireAdmin } from '../middleware/require-admin.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/settings — текущие настройки приложения
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: settingsService.get() });
  }),
);

// PUT /api/settings — обновить настройки приложения (только admin)
router.put(
  '/',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const settings = settingsService.update(req.body ?? {});
    res.json({ success: true, data: settings });
  }),
);

export default router;
