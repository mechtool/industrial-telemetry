import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export interface KratosIdentity {
  id: string;
  email: string;
  username: string;
  role: string;
  department?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: KratosIdentity;
    }
  }
}

/**
 * Проверяет Kratos-сессию через /sessions/whoami.
 * При успехе добавляет req.user с данными пользователя.
 */
export async function kratosAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookie = req.headers.cookie;

  if (!cookie) {
    res.status(401).json({
      success: false,
      error: { message: 'Требуется аутентификация. Сессия не найдена.' },
    });
    return;
  }

  try {
    const response = await fetch(`${config.kratos.publicUrl}/sessions/whoami`, {
      headers: { Cookie: cookie },
    });

    if (!response.ok) {
      res.status(401).json({
        success: false,
        error: { message: 'Сессия истекла или недействительна.' },
      });
      return;
    }

    const session = await response.json() as {
      id: string;
      identity: {
        id: string;
        traits: {
          email: string;
          username: string;
          role?: string;
          department?: string;
        };
      };
    };

    req.user = {
      id: session.identity.id,
      email: session.identity.traits.email,
      username: session.identity.traits.username,
      role: session.identity.traits.role || 'operator',
      department: session.identity.traits.department,
    };

    next();
  } catch (err) {
    console.error('[Kratos] Ошибка проверки сессии:', err);
    res.status(502).json({
      success: false,
      error: { message: 'Сервис аутентификации недоступен.' },
    });
  }
}

/**
 * Опциональная аутентификация: не блокирует запрос, но добавляет user если сессия есть.
 */
export async function kratosOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cookie = req.headers.cookie;
  if (!cookie) return next();

  try {
    const response = await fetch(`${config.kratos.publicUrl}/sessions/whoami`, {
      headers: { Cookie: cookie },
    });
    if (response.ok) {
      const session = await response.json() as any;
      req.user = {
        id: session.identity.id,
        email: session.identity.traits.email,
        username: session.identity.traits.username,
        role: session.identity.traits.role || 'operator',
        department: session.identity.traits.department,
      };
    }
  } catch {
    // silently ignore
  }
  next();
}
