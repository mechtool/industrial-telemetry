import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware — проверяет JWT токен из заголовка Authorization.
 * При успехе добавляет req.user с payload токена.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: { message: 'Требуется аутентификация. Токен не предоставлен.' },
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: { message: 'Некорректный формат токена. Ожидается: Bearer <token>' },
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Срок действия токена истёк. Пожалуйста, войдите снова.'
        : 'Недействительный токен. Пожалуйста, войдите снова.';

    res.status(401).json({
      success: false,
      error: { message },
    });
  }
}
