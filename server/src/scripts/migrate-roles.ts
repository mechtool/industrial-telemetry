import { config } from '../config/index.js';
import { ketoService, Roles } from '../services/keto.service.js';

/**
 * Одноразовая миграция: перенос ролей из устаревшего traits.role (Kratos)
 * в Keto (relation tuples), с последующей очисткой traits.role.
 *
 * Запуск: npm run migrate:roles  (из каталога server/)
 *
 * Идемпотентна: если у пользователя уже есть роли в Keto — назначение
 * пропускается; traits.role удаляется только при наличии.
 */

interface KratosIdentity {
  id: string;
  state: string;
  schema_id: string;
  traits: Record<string, unknown> & {
    username?: string;
    email?: string;
    role?: string;
  };
}

const LEGACY_ROLE_MAP: Record<string, string> = {
  admin: Roles.ADMIN,
  engineer: Roles.ENGINEER,
  operator: Roles.OPERATOR,
};

async function main(): Promise<void> {
  console.log('[migrate-roles] Читаю identities из Kratos admin...');
  const r = await fetch(`${config.kratos.adminUrl}/admin/identities?per_page=500`);
  if (!r.ok) {
    throw new Error(`Kratos admin responded ${r.status}`);
  }
  const identities = (await r.json()) as KratosIdentity[];

  let assigned = 0;
  let cleaned = 0;
  let skipped = 0;

  for (const identity of identities) {
    if (identity.state !== 'active') {
      skipped += 1;
      continue;
    }

    const existingRoles = await ketoService.listRoles(identity.id);
    if (existingRoles.length === 0) {
      const legacyRole = identity.traits?.role;
      const targetRole = LEGACY_ROLE_MAP[legacyRole as string] ?? Roles.VIEWER;
      if (await ketoService.assignRole(identity.id, targetRole)) {
        assigned += 1;
        console.log(`  [role] ${identity.id} -> ${targetRole} (legacy=${legacyRole ?? '—'})`);
      } else {
        console.warn(`  [warn] Не удалось назначить роль для ${identity.id}`);
      }
    } else {
      skipped += 1;
      console.log(`  [skip] ${identity.id} уже имеет роли: ${existingRoles.join(', ')}`);
    }

    // Очистить устаревший traits.role (схема identity.schema.json его больше не содержит)
    if (identity.traits && 'role' in identity.traits) {
      const { role: _legacy, ...restTraits } = identity.traits;
      const putRes = await fetch(`${config.kratos.adminUrl}/admin/identities/${identity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: identity.schema_id,
          state: identity.state,
          traits: restTraits,
        }),
      });
      if (putRes.ok) {
        cleaned += 1;
      } else {
        console.warn(`  [warn] Не удалось очистить traits.role у ${identity.id} (${putRes.status})`);
      }
    }
  }

  console.log(
    `[migrate-roles] Готово: ролей назначено=${assigned}, traits.role очищено=${cleaned}, пропущено=${skipped}`,
  );
}

main().catch((err) => {
  console.error('[migrate-roles] Ошибка:', err);
  process.exit(1);
});
