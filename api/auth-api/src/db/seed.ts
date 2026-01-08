import 'dotenv/config';
import { z } from 'zod';
import { createDbPool } from './pool.js';
import { hashPassword } from '../auth/password.js';

const SeedEnv = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ISSUER: z.string().min(1).default('d2-ride-booking'),
  TOTP_ENC_KEY_BASE64: z.string().min(1),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  SEED_DRIVER_EMAIL: z.string().email().optional(),
  SEED_DRIVER_PHONE: z.string().min(6).optional(),
  SEED_DRIVER_PASSWORD: z.string().min(8).default('ChangeMe123!'),

  SEED_PASSENGER_EMAIL: z.string().email().optional(),
  SEED_PASSENGER_PHONE: z.string().min(6).optional(),
  SEED_PASSENGER_PASSWORD: z.string().min(8).default('ChangeMe123!')
});

type PermissionSeed = { key: string; description: string };

/**
 * PERMISSION DESIGN PRINCIPLES
 * 
 * 1. Granular & Feature-Aligned: Each permission maps to a specific UI feature or action
 * 2. Frontend-Friendly: Permission names clearly indicate what UI elements they control
 * 3. Backend-Enforceable: Backend validates these on every protected endpoint
 * 4. Migration-Ready: Permission keys are stable strings that survive auth provider changes
 * 
 * Naming convention: <domain>.<resource>.<action>
 * - domain: admin (vs driver/passenger in future)
 * - resource: dashboard, passengers, drivers, etc.
 * - action: view, create, edit, delete, manage, export
 */
const DEFAULT_PERMISSIONS: PermissionSeed[] = [
  // Dashboard & Operations
  { key: 'admin.dashboard.view', description: 'View live operations dashboard' },
  { key: 'admin.dashboard.control', description: 'Control rides and dispatch operations' },
  
  // Passenger Management
  { key: 'admin.passengers.view', description: 'View passenger list and profiles' },
  { key: 'admin.passengers.edit', description: 'Edit passenger information' },
  { key: 'admin.passengers.delete', description: 'Delete/suspend passengers' },
  
  // Driver Management
  { key: 'admin.drivers.view', description: 'View driver list and profiles' },
  { key: 'admin.drivers.edit', description: 'Edit driver information and approvals' },
  { key: 'admin.drivers.delete', description: 'Delete/suspend drivers' },
  
  // Dispute Resolution
  { key: 'admin.disputes.view', description: 'View disputes and support tickets' },
  { key: 'admin.disputes.resolve', description: 'Resolve disputes and issue refunds' },
  
  // Pricing & Promotions
  { key: 'admin.pricing.view', description: 'View pricing rules and promotions' },
  { key: 'admin.pricing.manage', description: 'Create and modify pricing rules' },
  
  // Analytics & Reports
  { key: 'admin.analytics.view', description: 'View analytics dashboards' },
  { key: 'admin.analytics.export', description: 'Export reports and data' },
  
  // Fraud Detection & Audit
  { key: 'admin.fraud.view', description: 'View fraud detection dashboard' },
  { key: 'admin.fraud.investigate', description: 'Investigate and flag fraudulent activity' },
  
  // Admin & RBAC Management
  { key: 'admin.admins.view', description: 'View admin users list' },
  { key: 'admin.admins.manage', description: 'Create/edit/delete admin users' },
  { key: 'admin.roles.view', description: 'View roles and permissions' },
  { key: 'admin.roles.manage', description: 'Create/edit roles and assign permissions' },
  
  // System Settings
  { key: 'admin.settings.view', description: 'View system settings' },
  { key: 'admin.settings.manage', description: 'Modify system configuration' }
];

async function upsertPermission(db: ReturnType<typeof createDbPool>, p: PermissionSeed) {
  const result = await db.query<{ id: string }>(
    `insert into admin_permissions(key, description)
     values ($1, $2)
     on conflict (key) do update set description = excluded.description
     returning id`,
    [p.key, p.description]
  );
  return result.rows[0].id;
}

async function upsertRole(db: ReturnType<typeof createDbPool>, name: string, description: string) {
  const result = await db.query<{ id: string }>(
    `insert into admin_roles(name, description)
     values ($1, $2)
     on conflict (name) do update set description = excluded.description
     returning id`,
    [name, description]
  );
  return result.rows[0].id;
}

async function attachRolePermission(db: ReturnType<typeof createDbPool>, roleId: string, permId: string) {
  await db.query(
    `insert into admin_role_permissions(role_id, permission_id)
     values ($1, $2)
     on conflict do nothing`,
    [roleId, permId]
  );
}

async function attachRoleInheritance(db: ReturnType<typeof createDbPool>, parentRoleId: string, childRoleId: string) {
  await db.query(
    `insert into admin_role_inheritance(parent_role_id, child_role_id)
     values ($1, $2)
     on conflict do nothing`,
    [parentRoleId, childRoleId]
  );
}

async function attachUserRole(db: ReturnType<typeof createDbPool>, userId: string, roleId: string) {
  await db.query(
    `insert into admin_user_roles(user_id, role_id)
     values ($1, $2)
     on conflict do nothing`,
    [userId, roleId]
  );
}

async function upsertUserByEmail(db: ReturnType<typeof createDbPool>, opts: {
  userType: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  email: string;
  passwordHash: string;
}) {
  const result = await db.query<{ id: string }>(
    `insert into users(user_type, email, password_hash, is_active)
     values ($1::user_type, $2, $3, true)
     on conflict (email) do update
       set user_type = excluded.user_type,
           password_hash = excluded.password_hash,
           is_active = true
     returning id`,
    [opts.userType, opts.email, opts.passwordHash]
  );
  return result.rows[0].id;
}

async function upsertUserByPhone(db: ReturnType<typeof createDbPool>, opts: {
  userType: 'DRIVER' | 'PASSENGER';
  phone: string;
  passwordHash: string;
}) {
  const result = await db.query<{ id: string }>(
    `insert into users(user_type, phone, password_hash, is_active)
     values ($1::user_type, $2, $3, true)
     on conflict (phone) do update
       set user_type = excluded.user_type,
           password_hash = excluded.password_hash,
           is_active = true
     returning id`,
    [opts.userType, opts.phone, opts.passwordHash]
  );
  return result.rows[0].id;
}

async function ensureAdminTotpDisabled(db: ReturnType<typeof createDbPool>, userId: string) {
  // For first-run UX: do NOT pre-enroll Admin TOTP.
  // This forces /admin/auth/login to return TWO_FACTOR_ENROLLMENT_REQUIRED with an enrollToken.
  // Then the UI/user completes enrollment via /admin/auth/2fa/setup and /admin/auth/2fa/confirm.
  await db.query(
    `update admin_totp
     set enabled = false,
         enrolled_at = null,
         last_used_at = null
     where user_id = $1`,
    [userId]
  );
}

async function main() {
  const env = SeedEnv.parse(process.env);
  const db = createDbPool(env.DATABASE_URL);

  const driverIdentifier = env.SEED_DRIVER_EMAIL ?? env.SEED_DRIVER_PHONE;
  const passengerIdentifier = env.SEED_PASSENGER_EMAIL ?? env.SEED_PASSENGER_PHONE;
  if (!driverIdentifier) {
    throw new Error('Provide SEED_DRIVER_EMAIL or SEED_DRIVER_PHONE');
  }
  if (!passengerIdentifier) {
    throw new Error('Provide SEED_PASSENGER_EMAIL or SEED_PASSENGER_PHONE');
  }

  const client = await db.connect();
  try {
    await client.query('begin');

    // 1) Permissions
    const permIds = new Map<string, string>();
    for (const p of DEFAULT_PERMISSIONS) {
      const id = await upsertPermission(client as any, p);
      permIds.set(p.key, id);
    }

    // 2) Roles + hierarchy
    //
    // ROLE DESIGN:
    // - support_admin: Read-only access to support tickets, user profiles, basic analytics
    // - ops_admin: Full operations control (dashboard, disputes, pricing)
    // - super_admin: Full system access including RBAC management
    //
    // Hierarchy: super_admin inherits from ops_admin and support_admin
    
    const roleSuperAdmin = await upsertRole(client as any, 'super_admin', 'Full system access including RBAC management');
    const roleOps = await upsertRole(client as any, 'ops_admin', 'Operations admin - full control over rides, pricing, disputes');
    const roleSupport = await upsertRole(client as any, 'support_admin', 'Support admin - read-only access to help users');

    // Support Admin: Read-only permissions
    await attachRolePermission(client as any, roleSupport, permIds.get('admin.dashboard.view')!);
    await attachRolePermission(client as any, roleSupport, permIds.get('admin.passengers.view')!);
    await attachRolePermission(client as any, roleSupport, permIds.get('admin.drivers.view')!);
    await attachRolePermission(client as any, roleSupport, permIds.get('admin.disputes.view')!);
    await attachRolePermission(client as any, roleSupport, permIds.get('admin.analytics.view')!);

    // Ops Admin: Full operational control (inherits support + adds write permissions)
    await attachRolePermission(client as any, roleOps, permIds.get('admin.dashboard.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.dashboard.control')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.passengers.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.passengers.edit')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.drivers.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.drivers.edit')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.disputes.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.disputes.resolve')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.pricing.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.pricing.manage')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.analytics.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.analytics.export')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.fraud.view')!);
    await attachRolePermission(client as any, roleOps, permIds.get('admin.fraud.investigate')!);

    // Super Admin: Inherits all ops + support permissions via hierarchy, plus RBAC management
    await attachRoleInheritance(client as any, roleSuperAdmin, roleOps);
    await attachRoleInheritance(client as any, roleSuperAdmin, roleSupport);
    
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.passengers.delete')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.drivers.delete')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.admins.view')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.admins.manage')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.roles.view')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.roles.manage')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.settings.view')!);
    await attachRolePermission(client as any, roleSuperAdmin, permIds.get('admin.settings.manage')!);

    // 3) Users
    const adminHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
    const adminUserId = await upsertUserByEmail(client as any, {
      userType: 'ADMIN',
      email: env.SEED_ADMIN_EMAIL,
      passwordHash: adminHash
    });

    const driverHash = await hashPassword(env.SEED_DRIVER_PASSWORD);
    const driverUserId = env.SEED_DRIVER_EMAIL
      ? await upsertUserByEmail(client as any, {
          userType: 'DRIVER',
          email: env.SEED_DRIVER_EMAIL,
          passwordHash: driverHash
        })
      : await upsertUserByPhone(client as any, {
          userType: 'DRIVER',
          phone: env.SEED_DRIVER_PHONE!,
          passwordHash: driverHash
        });

    const passengerHash = await hashPassword(env.SEED_PASSENGER_PASSWORD);
    const passengerUserId = env.SEED_PASSENGER_EMAIL
      ? await upsertUserByEmail(client as any, {
          userType: 'PASSENGER',
          email: env.SEED_PASSENGER_EMAIL,
          passwordHash: passengerHash
        })
      : await upsertUserByPhone(client as any, {
          userType: 'PASSENGER',
          phone: env.SEED_PASSENGER_PHONE!,
          passwordHash: passengerHash
        });

    // 4) Assign Admin roles
    await attachUserRole(client as any, adminUserId, roleSuperAdmin);

    await client.query('commit');

    // 5) Ensure Admin starts with TOTP disabled (so enrollment flow is exercised)
    await ensureAdminTotpDisabled(db, adminUserId);

    // eslint-disable-next-line no-console
    console.log('--- Seed complete ---');
    // eslint-disable-next-line no-console
    console.log('admin:', env.SEED_ADMIN_EMAIL);
    // eslint-disable-next-line no-console
    console.log('adminTotp:', 'DISABLED (use /admin/auth/login to get enrollToken)');
    // eslint-disable-next-line no-console
    console.log('driver:', env.SEED_DRIVER_EMAIL ?? env.SEED_DRIVER_PHONE);
    // eslint-disable-next-line no-console
    console.log('passenger:', env.SEED_PASSENGER_EMAIL ?? env.SEED_PASSENGER_PHONE);
    // eslint-disable-next-line no-console
    console.log('driverUserId:', driverUserId);
    // eslint-disable-next-line no-console
    console.log('passengerUserId:', passengerUserId);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

await main();
