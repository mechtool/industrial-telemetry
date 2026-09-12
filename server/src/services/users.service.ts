import { config } from '../config/index.js';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

const ALLOWED_ROLES = ['admin', 'engineer', 'operator'];

interface KratosIdentity {
  id: string;
  state: string;
  schema_id: string;
  traits: {
    username?: string;
    email?: string;
    role?: string;
    [key: string]: unknown;
  };
}

function toAdminUser(identity: KratosIdentity): AdminUser {
  return {
    id: identity.id,
    username: identity.traits?.username ?? '',
    email: identity.traits?.email ?? '',
    role: identity.traits?.role ?? 'operator',
  };
}

class UsersService {
  /** Список активных пользователей из Kratos. */
  async list(): Promise<AdminUser[]> {
    const r = await fetch(`${config.kratos.adminUrl}/admin/identities?per_page=200`);
    if (!r.ok) {
      throw new Error(`Kratos admin responded ${r.status}`);
    }

    const identities = (await r.json()) as KratosIdentity[];
    return identities
      .filter((i) => i.state === 'active')
      .map(toAdminUser)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  /** Обновить роль пользователя (traits.role). */
  async updateRole(userId: string, role: string): Promise<AdminUser> {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Недопустимая роль: ${role}`);
    }

    const getRes = await fetch(`${config.kratos.adminUrl}/admin/identities/${userId}`);
    if (!getRes.ok) {
      throw new Error('Пользователь не найден');
    }

    const identity = (await getRes.json()) as KratosIdentity;
    const body = {
      schema_id: identity.schema_id,
      state: identity.state,
      traits: { ...identity.traits, role },
    };

    const putRes = await fetch(`${config.kratos.adminUrl}/admin/identities/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      throw new Error(`Не удалось обновить роль (${putRes.status})`);
    }

    return toAdminUser((await putRes.json()) as KratosIdentity);
  }
}

// Синглтон
export const usersService = new UsersService();
