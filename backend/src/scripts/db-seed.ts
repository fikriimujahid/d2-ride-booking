import { createDbPool, closeDbPool } from '../shared/db.js';
import { AppError } from '../shared/errors.js';
import { hashPassword } from '../modules/auth/password.js';
import type { UserRole } from '../modules/auth/types.js';

type SeedUser = {
  role: UserRole;
  email: string | null;
  phone: string | null;
  password: string;
};

type UserIdRow = { id: string };

type IdRow = { id: string };

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getSeedPassword(name: string): string {
  const v = getEnv(name);
  if (v) return v;
  // Safe-ish default for local dev only; users should override via env.
  return 'ChangeMe123!';
}

function seedUsers(): SeedUser[] {
  const adminEmail = getEnv('SEED_ADMIN_EMAIL') ?? 'admin@example.com';
  const driverEmail = getEnv('SEED_DRIVER_EMAIL') ?? 'driver@example.com';
  const passengerEmail = getEnv('SEED_PASSENGER_EMAIL') ?? 'passenger@example.com';

  return [
    {
      role: 'ADMIN',
      email: adminEmail,
      phone: null,
      password: getSeedPassword('SEED_ADMIN_PASSWORD')
    },
    {
      role: 'DRIVER',
      email: driverEmail,
      phone: null,
      password: getSeedPassword('SEED_DRIVER_PASSWORD')
    },
    {
      role: 'PASSENGER',
      email: passengerEmail,
      phone: null,
      password: getSeedPassword('SEED_PASSENGER_PASSWORD')
    }
  ];
}

async function upsertUser(pool: ReturnType<typeof createDbPool>, user: SeedUser): Promise<string> {
  if (!user.email && !user.phone) {
    throw new AppError('Seed user must have email or phone', { statusCode: 500, code: 'SEED_CONFIG_ERROR' });
  }
  if (user.role === 'ADMIN' && !user.email) {
    throw new AppError('Admin seed requires email', { statusCode: 500, code: 'SEED_CONFIG_ERROR' });
  }

  const passwordHash = await hashPassword(user.password);

  let existingId: string | null = null;

  if (user.email) {
    const existing = await pool.query<UserIdRow>(
      'SELECT id FROM users WHERE role = $1 AND lower(email) = lower($2) LIMIT 1',
      [user.role, user.email]
    );
    existingId = existing.rows[0]?.id ?? null;
  } else if (user.phone) {
    const existing = await pool.query<UserIdRow>(
      'SELECT id FROM users WHERE role = $1 AND phone = $2 LIMIT 1',
      [user.role, user.phone]
    );
    existingId = existing.rows[0]?.id ?? null;
  }

  if (existingId) {
    await pool.query(
      'UPDATE users SET password_hash = $1, is_active = true, updated_at = now() WHERE id = $2',
      [passwordHash, existingId]
    );
    return existingId;
  }

  const inserted = await pool.query<UserIdRow>(
    'INSERT INTO users (role, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [user.role, user.email, user.phone, passwordHash]
  );

  const id = inserted.rows[0]?.id;
  if (!id) {
    throw new AppError('Failed to insert seed user', { statusCode: 500, code: 'SEED_FAILED' });
  }
  return id;
}

async function upsertRbacRole(pool: ReturnType<typeof createDbPool>, name: string, description: string): Promise<string> {
  const res = await pool.query<IdRow>(
    `INSERT INTO rbac_roles (name, description)
     VALUES ($1, $2)
     ON CONFLICT (name)
     DO UPDATE SET description = EXCLUDED.description
     RETURNING id`,
    [name, description]
  );

  const id = res.rows[0]?.id;
  if (!id) {
    throw new AppError('Failed to upsert RBAC role', { statusCode: 500, code: 'SEED_FAILED' });
  }
  return id;
}

async function upsertRbacPermission(pool: ReturnType<typeof createDbPool>, code: string, description: string): Promise<string> {
  const res = await pool.query<IdRow>(
    `INSERT INTO rbac_permissions (code, description)
     VALUES ($1, $2)
     ON CONFLICT (code)
     DO UPDATE SET description = EXCLUDED.description
     RETURNING id`,
    [code, description]
  );

  const id = res.rows[0]?.id;
  if (!id) {
    throw new AppError('Failed to upsert RBAC permission', { statusCode: 500, code: 'SEED_FAILED' });
  }
  return id;
}

async function ensureSeedAdminRbac(pool: ReturnType<typeof createDbPool>, adminUserId: string): Promise<void> {
  // Baseline permissions used by middleware examples.
  const permissions: Array<{ code: string; description: string }> = [
    { code: 'admin:rbac:read', description: 'Read RBAC configuration' },
    { code: 'admin:rbac:write', description: 'Modify RBAC configuration' },
    { code: 'admin:users:read', description: 'Read users' },
    { code: 'admin:users:write', description: 'Modify users' }
  ];

  const roleId = await upsertRbacRole(pool, 'ADMIN_SUPER', 'Full admin access');
  const permissionIds: string[] = [];
  for (const p of permissions) {
    permissionIds.push(await upsertRbacPermission(pool, p.code, p.description));
  }

  for (const permissionId of permissionIds) {
    await pool.query(
      'INSERT INTO rbac_role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, permissionId]
    );
  }

  await pool.query('INSERT INTO rbac_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    adminUserId,
    roleId
  ]);
}

async function main(): Promise<void> {
  const pool = createDbPool();
  try {
    const users = seedUsers();

    let adminUserId: string | null = null;

    for (const u of users) {
      const id = await upsertUser(pool, u);
      console.log(`db:seed: ensured user role=${u.role} id=${id}`);

      if (u.role === 'ADMIN') {
        adminUserId = id;
      }
    }

    if (adminUserId) {
      await ensureSeedAdminRbac(pool, adminUserId);
      console.log('db:seed: ensured RBAC for seed admin');
    }

    console.log('db:seed: done');
  } finally {
    await closeDbPool(pool);
  }
}

void main();
