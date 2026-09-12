import { Request, Response, NextFunction } from 'express';

/**
 * Требует роль admin у аутентифицированного пользователя (req.user.role).
 * Использовать после kratosAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: { message: 'Требуется роль admin' } });
    return;
  }
  next();
}
