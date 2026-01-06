import 'dotenv/config';

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'node:crypto';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getAttr(
  attrs: Array<{ Name?: string; Value?: string }> | undefined,
  key: string,
): string | undefined {
  return attrs?.find((a) => a.Name === key)?.Value;
}

function makeTempPassword(): string {
  // Meets typical Cognito password policy: upper/lower/number/special.
  const suffix = randomBytes(6).toString('hex');
  return `TempA1!${suffix}`;
}

type DemoUser = {
  email: string;
  name: string;
  groupName: 'Admin' | 'Driver' | 'Passenger';
};

async function provisionOne(
  cognito: CognitoIdentityProviderClient,
  prisma: PrismaClient,
  userPoolId: string,
  user: DemoUser,
) {
  const temporaryPassword = makeTempPassword();

  let cognitoSub: string | undefined;
  let createdInCognito = false;

  try {
    const existing = await cognito.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
      }),
    );
    cognitoSub = getAttr(existing.UserAttributes, 'sub');
  } catch {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        TemporaryPassword: temporaryPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: user.name },
        ],
      }),
    );

    createdInCognito = true;
    cognitoSub = getAttr(created.User?.Attributes, 'sub');
  }

  // Ensure a temporary password is set (FORCE_CHANGE_PASSWORD) even if the user already existed.
  // This matches the "Temporary password + force password change" requirement.
  if (!createdInCognito) {
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        Password: temporaryPassword,
        Permanent: false,
      }),
    );
  }

  // Ensure user is in the expected Cognito Group.
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      GroupName: user.groupName,
    }),
  );

  if (!cognitoSub) {
    // Still proceed with DB user creation, but warn.
    // (Some Cognito configs can omit sub in responses; AdminGetUser should include it.)
    cognitoSub = undefined;
  }

  // Prefer syncing by Cognito sub to avoid mismatches when earlier sync created a placeholder email.
  const dbUser = await upsertDbUser(prisma, {
    email: user.email,
    name: user.name,
    cognitoSub: cognitoSub ?? null,
  });

  const credentials = {
    temporaryPassword,
    mustChangePassword: true,
  };

  return {
    email: user.email,
    group: user.groupName,
    cognitoSub: cognitoSub ?? null,
    dbUserId: dbUser.id,
    credentials,
  };
}

async function upsertDbUser(
  prisma: PrismaClient,
  input: { email: string; name: string; cognitoSub: string | null },
) {
  const { email, name, cognitoSub } = input;

  // 1) If we have a sub, it is the strongest identifier.
  if (cognitoSub) {
    const existingBySub = await prisma.user.findUnique({ where: { cognitoSub } });
    if (existingBySub) {
      try {
        return await prisma.user.update({
          where: { id: existingBySub.id },
          data: { email, name, cognitoSub },
        });
      } catch (err: unknown) {
        // If the target email is already used by another row, keep the existing email.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return await prisma.user.update({
            where: { id: existingBySub.id },
            data: { name, cognitoSub },
          });
        }
        throw err;
      }
    }

    // No row by sub yet. Try to attach sub to an email row if it exists; otherwise create.
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { name, cognitoSub },
      });
    }

    return await prisma.user.create({
      data: { email, name, cognitoSub },
    });
  }

  // 2) Fallback: upsert by email.
  return await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}

async function main() {
  const region = requireEnv('AWS_REGION');
  const userPoolId = requireEnv('COGNITO_USER_POOL_ID');
  const databaseUrl = requireEnv('DATABASE_URL');

  const cognito = new CognitoIdentityProviderClient({ region });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const demoUsers: DemoUser[] = [
    { email: 'superadmin@example.com', name: 'Super Admin', groupName: 'Admin' },
    { email: 'driver1@example.com', name: 'Driver 1', groupName: 'Driver' },
    { email: 'passenger1@example.com', name: 'Passenger 1', groupName: 'Passenger' },
  ];

  try {
    const results = [];
    for (const user of demoUsers) {
      results.push(await provisionOne(cognito, prisma, userPoolId, user));
    }

    // Print credentials & identifiers
    // eslint-disable-next-line no-console
    console.log('\nProvisioned demo users:');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(
      '\nNote: Users created with a temporary password will be in FORCE_CHANGE_PASSWORD until they set a new password.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
