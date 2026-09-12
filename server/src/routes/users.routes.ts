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

// PUT /api/users/:id/role — изменить роль пользователя (только admin)
router.put(
  '/:id/role',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const userId = Array.isArray(rawId) ? rawId[0] : rawId;
    const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';

    if (!userId || !role) {
      res.status(400).json({ success: false, error: { message: 'id и role обязательны' } });
      return;
    }

    const user = await usersService.updateRole(userId, role);
    res.json({ success: true, data: user });
  }),
);

export default router;
