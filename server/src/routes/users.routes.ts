import { Router, Request, Response } from 'express';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/users — список пользователей с пагинацией
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    const filter = search
      ? {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// GET /api/users/:id — один пользователь
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Пользователь не найден' } });
      return;
    }
    res.json({ success: true, data: user });
  }),
);

// POST /api/users — создать пользователя
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  }),
);

// PUT /api/users/:id — обновить пользователя
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Пользователь не найден' } });
      return;
    }
    res.json({ success: true, data: user });
  }),
);

// DELETE /api/users/:id — удалить пользователя
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Пользователь не найден' } });
      return;
    }
    res.json({ success: true, data: { id: req.params.id } });
  }),
);

export default router;
