import { config } from '../config/index.js';
import { ketoService, Roles } from './keto.service.js';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

const ALLOWED_ROLES: string[] = [Roles.ADMIN, Roles.ENGINEER, Roles.OPERATOR, Roles.VIEWER];

interface KratosIdentity {
  id: string;
  state: string;
  schema_id: string;
  traits: {
    username?: string;
    email?: string;
    [key: string]: unknown;
  };
}

class UsersService {
  /** Список активных пользователей из Kratos + их роли из Keto. */
  async list(): Promise<AdminUser[]> {
    const r = await fetch(`${config.kratos.adminUrl}/admin/identities?per_page=200`);
    if (!r.ok) {
      throw new Error(`Kratos admin responded ${r.status}`);
    }

    const identities = (await r.json()) as KratosIdentity[];
    const active = identities.filter((i) => i.state === 'active');

    const users = await Promise.all(
      active.map(async (i) => ({
        id: i.id,
        username: i.traits?.username ?? '',
        email: i.traits?.email ?? '',
        roles: await ketoService.listRoles(i.id),
      })),
    );

    return users.sort((a, b) => a.username.localeCompare(b.username));
  }

  /** Привести набор ролей пользователя к заданному (хранится в Keto). */
  async setRoles(userId: string, roles: string[]): Promise<AdminUser> {
    const normalized = [...new Set(roles)];
    for (const role of normalized) {
      if (!ALLOWED_ROLES.includes(role)) {
        throw new Error(`Недопустимая роль: ${role}`);
      }
    }

    const ok = await ketoService.setRoles(userId, normalized);
    if (!ok) {
      throw new Error('Не удалось обновить роли в Keto');
    }

    const getRes = await fetch(`${config.kratos.adminUrl}/admin/identities/${userId}`);
    if (!getRes.ok) {
      throw new Error('Пользователь не найден');
    }

    const identity = (await getRes.json()) as KratosIdentity;
    return {
      id: identity.id,
      username: identity.traits?.username ?? '',
      email: identity.traits?.email ?? '',
      roles: normalized,
    };
  }
}

// Синглтон
export const usersService = new UsersService();
