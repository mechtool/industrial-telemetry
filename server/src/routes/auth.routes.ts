import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import { authenticate, JwtPayload } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';

const router = Router();

/** Генерация JWT токена */
function generateToken(user: { id?: string; _id?: unknown; username: string; email: string; role: string }): string {
  const payload: JwtPayload = {
    userId: (user.id ?? String(user._id)) as string,
    username: user.username,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

/** Поля пользователя для ответа (без passwordHash) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function userResponse(user: any) {
  return {
    id: user.id ?? String(user._id),
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin ?? null,
    metadata: user.metadata ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// POST /api/auth/login — аутентификация пользователя
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email и пароль обязательны.', reason: 'missing_fields' },
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Пользователь с таким email не найден.', reason: 'user_not_found' },
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: { message: 'Учётная запись деактивирована. Обратитесь к администратору.', reason: 'account_disabled' },
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: { message: 'Неверный пароль.', reason: 'invalid_password' },
      });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      data: { token, user: userResponse(user.toObject()) },
    });
  }),
);

// POST /api/auth/register — регистрация нового пользователя
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    // Валидация
    const errors: string[] = [];
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      errors.push('Имя пользователя должно содержать минимум 3 символа.');
    }
    if (username && username.trim().length > 64) {
      errors.push('Имя пользователя не должно превышать 64 символа.');
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      errors.push('Некорректный формат email.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      errors.push('Пароль должен содержать минимум 6 символов.');
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: { message: errors.join(' '), reason: 'validation_error' },
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    // Проверка дубликатов
    const [emailExists, usernameExists] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      User.findOne({ username: normalizedUsername }),
    ]);

    if (emailExists) {
      res.status(409).json({
        success: false,
        error: { message: 'Пользователь с таким email уже зарегистрирован.', reason: 'email_taken' },
      });
      return;
    }

    if (usernameExists) {
      res.status(409).json({
        success: false,
        error: { message: 'Имя пользователя уже занято.', reason: 'username_taken' },
      });
      return;
    }

    // Создание пользователя
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: 'operator',
      isActive: true,
      metadata: {},
    });

    // Авто-логин после регистрации
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { token, user: userResponse(user.toObject()) },
    });
  }),
);

// GET /api/auth/me — проверка токена и получение данных текущего пользователя
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'Пользователь не найден.' },
      });
      return;
    }

    res.json({
      success: true,
      data: userResponse(user.toObject()),
    });
  }),
);

export default router;
