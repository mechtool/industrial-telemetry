import { config } from '../config/index.js';

/**
 * Keto permission check request.
 * Keto v0.13+ REST API: POST /relation-tuples/check
 */
interface CheckRequest {
  namespace: string;
  object: string;
  relation: string;
  subject_id?: string;
  subject_set?: { namespace: string; object: string; relation: string };
}

interface CheckResponse {
  allowed: boolean;
}

/**
 * Keto relation tuple for write operations.
 */
interface RelationTuple {
  namespace: string;
  object: string;
  relation: string;
  subject_id?: string;
  subject_set?: { namespace: string; object: string; relation: string };
}

// ---- RBAC Resource Definitions ----
export const Resources = {
  DASHBOARD: 'dashboard',
  MQTT: 'mqtt',
  MQTT_TOPICS: 'mqtt-topics',
  USERS: 'users',
  SETTINGS: 'settings',
} as const;

export const Actions = {
  VIEW: 'viewers',
  EDIT: 'editors',
  ADMIN: 'admins',
} as const;

export const Roles = {
  ADMIN: 'admin',
  ENGINEER: 'engineer',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

/** Порядок ролей по старшинству (для определения «первичной» роли). */
export const ROLE_ORDER = [Roles.ADMIN, Roles.ENGINEER, Roles.OPERATOR, Roles.VIEWER] as const;

/** Наивысшая роль пользователя из списка. */
export function primaryRole(roles: string[]): string {
  for (const role of ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? Roles.VIEWER;
}

class KetoService {
  private readonly readUrl = config.keto.readUrl;
  private readonly writeUrl = config.keto.writeUrl;

  /**
   * Проверить, имеет ли пользователь доступ к ресурсу.
   *
   * @param userId  — Kratos identity UUID
   * @param resource — идентификатор ресурса (dashboard, mqtt, users, ...)
   * @param action — тип доступа (viewers, editors, admins)
   */
  async check(userId: string, resource: string, action: string): Promise<boolean> {
    const body: CheckRequest = {
      namespace: 'Resource',
      object: resource,
      relation: action,
      subject_id: userId,
    };

    try {
      const r = await fetch(`${this.readUrl}/relation-tuples/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) return false;
      const data = await r.json() as CheckResponse;
      return data.allowed;
    } catch {
      // Keto недоступен — запрещаем доступ по умолчанию (fail-closed)
      return false;
    }
  }

  /**
   * Проверить, состоит ли пользователь в указанной роли.
   */
  async hasRole(userId: string, role: string): Promise<boolean> {
    const body: CheckRequest = {
      namespace: 'Role',
      object: role,
      relation: 'member',
      subject_id: userId,
    };

    try {
      const r = await fetch(`${this.readUrl}/relation-tuples/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) return false;
      const data = await r.json() as CheckResponse;
      return data.allowed;
    } catch {
      return false;
    }
  }

  /**
   * Получить все роли пользователя из Keto.
   */
  async listRoles(userId: string): Promise<string[]> {
    const params = new URLSearchParams({
      namespace: 'Role',
      subject_id: userId,
    });

    try {
      const r = await fetch(`${this.readUrl}/relation-tuples?${params.toString()}`);
      if (!r.ok) return [];
      const data = await r.json() as {
        relation_tuples?: Array<{ object?: string }>;
      };
      const roles = (data.relation_tuples ?? [])
        .map((t) => t.object)
        .filter((o): o is string => typeof o === 'string');
      // Keto PUT не идемпотентен — защищаемся от дубликатов на чтении.
      return [...new Set(roles)];
    } catch {
      return [];
    }
  }

  /**
   * Назначить роль пользователю (идемпотентно).
   */
  async assignRole(userId: string, role: string): Promise<boolean> {
    return this.withRoleLock(userId, () => this.assignRoleInternal(userId, role));
  }

  /**
   * Снять роль у пользователя.
   */
  async revokeRole(userId: string, role: string): Promise<boolean> {
    return this.withRoleLock(userId, () => this.revokeRoleInternal(userId, role));
  }

  /**
   * Привести набор ролей пользователя к заданному (снять лишние, назначить новые).
   */
  async setRoles(userId: string, roles: string[]): Promise<boolean> {
    return this.withRoleLock(userId, async () => {
      const desired = [...new Set(roles)];
      const current = await this.listRoles(userId);
      const toRemove = current.filter((r) => !desired.includes(r));
      const toAdd = desired.filter((r) => !current.includes(r));

      let ok = true;
      for (const role of toRemove) {
        ok = (await this.revokeRoleInternal(userId, role)) && ok;
      }
      for (const role of toAdd) {
        ok = (await this.assignRoleInternal(userId, role)) && ok;
      }
      return ok;
    });
  }

  // ---- Внутренняя реализация (без блокировки) ----

  /**
   * Сериализация мутаций ролей на одного пользователя.
   * Keto PUT не идемпотентен, а webhook и fallback могут работать конкурентно
   * и создавать дубликаты — блокировка на userId это исключает.
   */
  private readonly roleQueues = new Map<string, Promise<void>>();

  private async withRoleLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.roleQueues.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = prev.then(() => gate);
    this.roleQueues.set(userId, tail);

    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.roleQueues.get(userId) === tail) {
        this.roleQueues.delete(userId);
      }
    }
  }

  private async assignRoleInternal(userId: string, role: string): Promise<boolean> {
    // Проверяем наличие заранее — Keto PUT не идемпотентен.
    const existing = await this.listRoles(userId);
    if (existing.includes(role)) return true;

    const tuple: RelationTuple = {
      namespace: 'Role',
      object: role,
      relation: 'member',
      subject_id: userId,
    };

    try {
      const r = await fetch(`${this.writeUrl}/admin/relation-tuples`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tuple),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  private async revokeRoleInternal(userId: string, role: string): Promise<boolean> {
    const params = new URLSearchParams({
      namespace: 'Role',
      object: role,
      relation: 'member',
      subject_id: userId,
    });

    try {
      const r = await fetch(`${this.writeUrl}/admin/relation-tuples?${params.toString()}`, {
        method: 'DELETE',
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  /**
   * Дать роли доступ к ресурсу.
   */
  async grantPermission(role: string, resource: string, action: string): Promise<boolean> {
    const tuple: RelationTuple = {
      namespace: 'Resource',
      object: resource,
      relation: action,
      subject_set: { namespace: 'Role', object: role, relation: 'member' },
    };

    try {
      const r = await fetch(`${this.writeUrl}/admin/relation-tuples`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tuple),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  /**
   * Seed начальных ролей и разрешений.
   * Вызывается при первом запуске.
   */
  async seedDefaults(): Promise<void> {
    const perms: Array<[string, string, string]> = [
      // Роль          Ресурс              Действие
      [Roles.ADMIN, Resources.DASHBOARD, Actions.VIEW],
      [Roles.ADMIN, Resources.DASHBOARD, Actions.EDIT],
      [Roles.ADMIN, Resources.DASHBOARD, Actions.ADMIN],
      [Roles.ADMIN, Resources.MQTT, Actions.VIEW],
      [Roles.ADMIN, Resources.MQTT, Actions.EDIT],
      [Roles.ADMIN, Resources.MQTT, Actions.ADMIN],
      [Roles.ADMIN, Resources.MQTT_TOPICS, Actions.VIEW],
      [Roles.ADMIN, Resources.MQTT_TOPICS, Actions.EDIT],
      [Roles.ADMIN, Resources.USERS, Actions.VIEW],
      [Roles.ADMIN, Resources.USERS, Actions.EDIT],
      [Roles.ADMIN, Resources.USERS, Actions.ADMIN],
      [Roles.ADMIN, Resources.SETTINGS, Actions.VIEW],
      [Roles.ADMIN, Resources.SETTINGS, Actions.EDIT],
      [Roles.ADMIN, Resources.SETTINGS, Actions.ADMIN],

      [Roles.ENGINEER, Resources.DASHBOARD, Actions.VIEW],
      [Roles.ENGINEER, Resources.DASHBOARD, Actions.EDIT],
      [Roles.ENGINEER, Resources.MQTT, Actions.VIEW],
      [Roles.ENGINEER, Resources.MQTT, Actions.EDIT],
      [Roles.ENGINEER, Resources.MQTT_TOPICS, Actions.VIEW],
      [Roles.ENGINEER, Resources.MQTT_TOPICS, Actions.EDIT],
      [Roles.ENGINEER, Resources.SETTINGS, Actions.VIEW],
      [Roles.ENGINEER, Resources.SETTINGS, Actions.EDIT],
      [Roles.ENGINEER, Resources.USERS, Actions.VIEW],

      [Roles.OPERATOR, Resources.DASHBOARD, Actions.VIEW],
      [Roles.OPERATOR, Resources.MQTT, Actions.VIEW],
      [Roles.OPERATOR, Resources.MQTT_TOPICS, Actions.VIEW],

      [Roles.VIEWER, Resources.DASHBOARD, Actions.VIEW],
      [Roles.VIEWER, Resources.MQTT, Actions.VIEW],
      [Roles.VIEWER, Resources.MQTT_TOPICS, Actions.VIEW],
    ];

    for (const [role, resource, action] of perms) {
      await this.grantPermission(role, resource, action);
    }

    console.log('[Keto] Default roles and permissions seeded.');
  }
}

// Синглтон
export const ketoService = new KetoService();
