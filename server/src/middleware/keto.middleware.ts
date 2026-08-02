import { Request, Response, NextFunction } from 'express';
import { ketoService, Actions } from '../services/keto.service.js';

/**
 * Middleware: проверить разрешение пользователя на ресурс.
 *
 * Использование:
 *   app.get('/api/mqtt/status', kratosAuth, requirePermission('mqtt', 'viewers'), handler);
 *
 * @param resource — идентификатор ресурса (dashboard, mqtt, mqtt-topics, users, settings)
 * @param action   — тип доступа (viewers, editors, admins)
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { message: 'Требуется аутентификация' } });
      return;
    }

    const allowed = await ketoService.check(req.user.id, resource, action);

    if (!allowed) {
      res.status(403).json({
        success: false,
        error: { message: `Недостаточно прав: требуется ${action} на ${resource}` },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: проверить, что пользователь имеет указанную роль.
 *
 * Использование:
 *   app.get('/api/admin', kratosAuth, requireRole('admin'), handler);
 */
export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { message: 'Требуется аутентификация' } });
      return;
    }

    const hasRole = await ketoService.hasRole(req.user.id, role);

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: { message: `Требуется роль: ${role}` },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: добавить объект permissions в req для использования в обработчиках.
 * Не блокирует запрос — только добавляет информацию.
 */
export async function loadPermissions(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    return next();
  }

  // Загружаем основные разрешения пользователя
  const [canViewDashboard, canEditMqtt, canManageUsers] = await Promise.all([
    ketoService.check(req.user.id, 'dashboard', Actions.VIEW),
    ketoService.check(req.user.id, 'mqtt', Actions.EDIT),
    ketoService.check(req.user.id, 'users', Actions.ADMIN),
  ]);

  (req as any).permissions = {
    canViewDashboard,
    canEditMqtt,
    canManageUsers,
    role: req.user.role,
  };

  next();
}
