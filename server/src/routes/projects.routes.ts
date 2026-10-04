import { Router, Request, Response } from 'express';
import { projectsService, CreateProjectInput } from '../services/projects.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

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

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    const code = asString(body.code);

    if (!name) {
      res.status(400).json({ success: false, error: { message: 'name обязателен' } });
      return;
    }
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'code обязателен' } });
      return;
    }

    const input: CreateProjectInput = {
      code,
      name,
      status: asString(body.status),
      monitoringType: asString(body.monitoringType),
      address: asString(body.address),
      phone: asString(body.phone),
      workMode: asString(body.workMode),
      manager: asString(body.manager),
      role: asString(body.role),
    };

    const project = projectsService.createForUser(userId, input);
    res.status(201).json({ success: true, data: project });
  }),
);

export default router;
