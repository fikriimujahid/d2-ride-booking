import 'dotenv/config';

import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const roles = [
    'SUPER_ADMIN',
    'DRIVER',
    'PASSENGER',
    'OPERATIONS_MANAGER',
  ] as const;

  const permissions = [
    'rides.create',
    'rides.read',
    'rides.update',
    'rides.delete',
    'drivers.manage',
    'passengers.manage',
  ] as const;

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await seedSuperAdminUser();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getAttr(attrs: Array<{ Name?: string; Value?: string }> | undefined, key: string) {
  return attrs?.find((a) => a.Name === key)?.Value;
}

async function seedSuperAdminUser() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (!email) {
    // Seed stays idempotent and safe for environments that don't want a bootstrap user.
    return;
  }

  const name = (process.env.SUPER_ADMIN_NAME ?? 'Super Admin').trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();

  const region = requireEnv('AWS_REGION');
  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');

  const cognito = new CognitoIdentityProviderClient({ region });

  // 1) Ensure user exists in Cognito and capture sub
  let cognitoSub: string | undefined;
  try {
    const existing = await cognito.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: email,
      }),
    );
    cognitoSub = getAttr(existing.UserAttributes, 'sub');
  } catch (e: any) {
    // If user doesn't exist, create it.
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: name },
        ],
      }),
    );
    cognitoSub = getAttr(created.User?.Attributes, 'sub');
  }

  if (password) {
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true,
      }),
    );
  }

  // 2) Upsert user in DB
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      cognitoSub: cognitoSub ?? undefined,
    },
    create: {
      email,
      name,
      cognitoSub: cognitoSub ?? undefined,
    },
  });

  // 3) Ensure SUPER_ADMIN role mapping
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found (seed roles should have created it)');
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
