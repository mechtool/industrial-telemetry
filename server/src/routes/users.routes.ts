import { Router, Request, Response } from 'express';
import { usersService } from '../services/users.service.js';
import { requireAdmin } from '../middleware/require-admin.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/users — список пользователей (только admin)
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await usersService.list();
    res.json({ success: true, data: users });
  }),
);

// PUT /api/users/:id/roles — изменить роли пользователя (только admin)
router.put(
  '/:id/roles',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const userId = Array.isArray(rawId) ? rawId[0] : rawId;
    const roles = Array.isArray(req.body?.roles)
      ? req.body.roles.map((r: unknown) => (typeof r === 'string' ? r.trim() : '')).filter(Boolean)
      : [];

    if (!userId) {
      res.status(400).json({ success: false, error: { message: 'id обязателен' } });
      return;
    }
    if (roles.length === 0) {
      res.status(400).json({ success: false, error: { message: 'roles должен быть непустым массивом' } });
      return;
    }

    const user = await usersService.setRoles(userId, roles);
    res.json({ success: true, data: user });
  }),
);

export default router;
