import { config } from '../config/index.js';
import { ketoService, Roles } from '../services/keto.service.js';

/**
 * Сидинг демо-пользователей публичной презентации.
 *
 * Создаёт в Kratos две учётные записи (по одной на точку зрения):
 *   - service@telemetry.ru — сервисные организации;
 *   - retail@telemetry.ru  — торговый ритейл.
 * Пароль у обеих одинаковый: `presentation`.
 *
 * Запуск: npm run seed:presentation  (из каталога server/)
 *
 * Идемпотентен: если identity с такой почтой уже существует — создание
 * пропускается, роль просто проверяется/назначается заново.
 */

interface SeedUser {
  email: string;
  username: string;
  department: string;
  password: string;
}

interface KratosIdentity {
  id: string;
  state: string;
  schema_id: string;
  traits: Record<string, unknown> & {
    email?: string;
    username?: string;
  };
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'service@telemetry.ru',
    username: 'Service Demo',
    department: 'Сервисная организация',
    password: 'presentation',
  },
  {
    email: 'retail@telemetry.ru',
    username: 'Retail Demo',
    department: 'Торговый ритейл',
    password: 'presentation',
  },
];

async function listIdentities(): Promise<KratosIdentity[]> {
  const r = await fetch(`${config.kratos.adminUrl}/admin/identities?per_page=500`);
  if (!r.ok) {
    throw new Error(`Kratos admin responded ${r.status}`);
  }
  return (await r.json()) as KratosIdentity[];
}

async function findIdentityByEmail(email: string): Promise<KratosIdentity | null> {
  const identities = await listIdentities();
  const normalized = email.trim().toLowerCase();
  return (
    identities.find((identity) => identity.traits?.email?.trim().toLowerCase() === normalized) ?? null
  );
}

async function createIdentity(user: SeedUser): Promise<KratosIdentity> {
  const r = await fetch(`${config.kratos.adminUrl}/admin/identities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schema_id: 'default',
      traits: {
        email: user.email,
        username: user.username,
        department: user.department,
      },
      credentials: {
        password: {
          config: { password: user.password },
        },
      },
    }),
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Не удалось создать ${user.email} (${r.status}): ${body}`);
  }

  return (await r.json()) as KratosIdentity;
}

async function main(): Promise<void> {
  console.log('[seed-presentation] Начинаю сидинг демо-пользователей презентации...');

  for (const user of SEED_USERS) {
    const existing = await findIdentityByEmail(user.email);

    const identity = existing ?? (await createIdentity(user));
    if (existing) {
      console.log(`  [skip] ${user.email} уже существует (${identity.id})`);
    } else {
      console.log(`  [create] ${user.email} создан (${identity.id})`);
    }

    if (await ketoService.assignRole(identity.id, Roles.VIEWER)) {
      console.log(`  [role] ${user.email} -> ${Roles.VIEWER}`);
    } else {
      console.warn(`  [warn] Не удалось назначить роль для ${user.email}`);
    }
  }

  console.log('[seed-presentation] Готово.');
}

main().catch((err) => {
  console.error('[seed-presentation] Ошибка:', err);
  process.exit(1);
});
