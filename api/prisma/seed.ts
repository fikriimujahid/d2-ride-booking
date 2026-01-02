import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';

const seedEnvSchema = z.object({
  AWS_REGION: z.string().min(1),
  COGNITO_USER_POOL_ID: z.string().min(1),

  DATABASE_URL: z.string().min(1),

  SEED_SUPERADMIN_EMAIL: z.string().email(),
  SEED_SUPERADMIN_TEMP_PASSWORD: z.string().optional().default(''),
  SEED_SUPERADMIN_PERMANENT_PASSWORD: z.string().optional().default(''),
  SEED_SUPERADMIN_SUPPRESS_INVITE: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
});

type SeedEnv = z.infer<typeof seedEnvSchema>;

const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

// Keep these aligned with API permission checks.
const BASE_PERMISSIONS = [
  { key: 'VIEW_ANALYTICS', name: 'View analytics' },
  { key: 'HANDLE_DISPUTES', name: 'Handle disputes' },
  { key: 'VIEW_USERS', name: 'View users' },
  { key: 'MANAGE_RIDES', name: 'Manage rides' },
  { key: 'MANAGE_RBAC', name: 'Manage RBAC' }
] as const;

async function ensureCognitoUser(env: SeedEnv, cognito: CognitoIdentityProviderClient) {
  const username = env.SEED_SUPERADMIN_EMAIL;

  let user = null as null | { username: string; sub: string };

  // 1) Try to get user
  try {
    const res = await cognito.send(
      new AdminGetUserCommand({
        UserPoolId: env.COGNITO_USER_POOL_ID,
        Username: username
      })
    );

    const sub = res.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) throw new Error('Cognito user exists but missing sub attribute');
    user = { username, sub };
  } catch (e: any) {
    // If user doesn't exist, create it.
    const notFound = typeof e?.name === 'string' && e.name.includes('UserNotFound');
    if (!notFound) {
      throw e;
    }
  }

  if (!user) {
    const suppressInvite = env.SEED_SUPERADMIN_SUPPRESS_INVITE === 'true';
    const tempPassword = env.SEED_SUPERADMIN_TEMP_PASSWORD || undefined;

    const createRes = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: env.COGNITO_USER_POOL_ID,
        Username: username,
        TemporaryPassword: tempPassword,
        MessageAction: suppressInvite ? 'SUPPRESS' : undefined,
        UserAttributes: [
          { Name: 'email', Value: username },
          { Name: 'email_verified', Value: 'true' }
        ]
      })
    );

    const sub = createRes.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      // Fallback: fetch it.
      const res = await cognito.send(
        new AdminGetUserCommand({
          UserPoolId: env.COGNITO_USER_POOL_ID,
          Username: username
        })
      );
      const sub2 = res.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
      if (!sub2) throw new Error('Created Cognito user but could not resolve sub');
      user = { username, sub: sub2 };
    } else {
      user = { username, sub };
    }
  }

  // 2) Optionally set a permanent password
  if (env.SEED_SUPERADMIN_PERMANENT_PASSWORD) {
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: env.COGNITO_USER_POOL_ID,
        Username: username,
        Password: env.SEED_SUPERADMIN_PERMANENT_PASSWORD,
        Permanent: true
      })
    );
  }

  // 3) Ensure in Admin group
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Username: username,
      GroupName: 'Admin'
    })
  );

  return user;
}

async function main() {
  const env = seedEnvSchema.parse(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(env.DATABASE_URL)
  });
  const cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

  // 1) Cognito user
  const cognitoUser = await ensureCognitoUser(env, cognito);

  // 2) RBAC role
  const role = await prisma.adminRole.upsert({
    where: { key: SUPER_ADMIN_ROLE_KEY },
    create: {
      key: SUPER_ADMIN_ROLE_KEY,
      name: 'Super Admin',
      description: 'Full administrative access'
    },
    update: {
      name: 'Super Admin',
      description: 'Full administrative access',
      deletedAt: null
    }
  });

  // 3) RBAC permissions + role mappings
  const permissions = [] as { id: string; key: string }[];
  for (const p of BASE_PERMISSIONS) {
    const perm = await prisma.adminPermission.upsert({
      where: { key: p.key },
      create: { key: p.key, name: p.name },
      update: { name: p.name, deletedAt: null }
    });
    permissions.push({ id: perm.id, key: perm.key });
  }

  for (const perm of permissions) {
    await prisma.adminRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id
        }
      },
      create: {
        roleId: role.id,
        permissionId: perm.id
      },
      update: {
        revokedAt: null,
        revokedByAdminUserId: null,
        deletedAt: null
      }
    });
  }

  // 4) DB admin user record (no Cognito groups stored)
  const adminUser = await prisma.adminUser.upsert({
    where: { cognitoSub: cognitoUser.sub },
    create: {
      cognitoSub: cognitoUser.sub,
      email: cognitoUser.username
    },
    update: {
      email: cognitoUser.username,
      deletedAt: null
    }
  });

  // 5) Assign SUPER_ADMIN role
  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: {
        adminUserId: adminUser.id,
        roleId: role.id
      }
    },
    create: {
      adminUserId: adminUser.id,
      roleId: role.id
    },
    update: {
      revokedAt: null,
      revokedByAdminUserId: null,
      deletedAt: null
    }
  });

  // 6) Append audit event (actor is null for seed)
  await prisma.adminRbacAuditEvent.create({
    data: {
      action: 'SEED_SUPERADMIN',
      targetAdminUserId: adminUser.id,
      roleId: role.id,
      ip: null,
      userAgent: 'prisma/seed',
      metadata: JSON.stringify({
        email: cognitoUser.username,
        permission_keys: permissions.map((p) => p.key)
      })
    }
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete:', {
    cognito_username: cognitoUser.username,
    cognito_sub: cognitoUser.sub,
    admin_user_id: adminUser.id,
    role: role.key,
    permissions: permissions.map((p) => p.key)
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
