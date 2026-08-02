// ========================================================
// Ory Keto — Permission Namespaces (OPL)
// Industrial Telemetry RBAC Model
//
// Модель:
//   User → member_of → Role
//   Role → can_read/can_write/can_admin → Resource
// ========================================================

/**
 * Role — группа пользователей с одинаковыми правами.
 * Админ может добавлять/удалять пользователей из роли.
 */
class Role implements Namespace {
  /** Пользователи, состоящие в этой роли */
  related: {
    member: User[]
  }
}

/**
 * Resource — защищаемый ресурс приложения.
 * Каждый ресурс имеет уровни доступа: read, write, admin.
 */
class Resource implements Namespace {
  related: {
    /** Кто может читать (viewer, operator, engineer, admin) */
    viewers: Role[]
    /** Кто может изменять (engineer, admin) */
    editors: Role[]
    /** Кто может администрировать (admin) */
    admins: Role[]
  }
}

// Ресурсы приложения — каждый имеет свой ID
// Примеры: "dashboard", "mqtt", "mqtt-topics:sensors", "users", "settings"

/**
 * User — идентификатор из Kratos (UUID).
 * Пустой namespace — идентификаторы берутся напрямую из Kratos identity.id.
 */
class User implements Namespace {
}
