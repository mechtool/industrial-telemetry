import { Router, Request, Response } from 'express';
import { projectsService } from '../services/projects.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/projects — проекты текущего пользователя (требует Kratos-сессии)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Требуется аутентификация' } });
      return;
    }

    res.json({
      success: true,
      data: projectsService.getForUser(userId),
    });
  }),
);

// POST /api/projects — создать проект для текущего пользователя
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Требуется аутентификация' } });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ success: false, error: { message: 'name обязателен' } });
      return;
    }

    const rawDescription = req.body?.description;
    const description = typeof rawDescription === 'string' && rawDescription.trim()
      ? rawDescription.trim()
      : undefined;

    const project = projectsService.createForUser(userId, { name, description });
    res.status(201).json({ success: true, data: project });
  }),
);

export default router;
