/// <reference types="node" />

import {
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminSetUserPasswordCommand,
    CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

function getAttr(attrs: { Name?: string; Value?: string }[] | undefined, name: string): string | undefined {
    return attrs?.find(a => a.Name === name)?.Value;
}

async function ensureCognitoUser(params: {
    userPoolId: string;
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    systemRole: 'ADMIN' | 'DRIVER' | 'PASSENGER';
}) {
    const client = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION || 'us-east-1'
    });

    // Try get existing user first (idempotent)
    try {
        const existing = await client.send(
            new AdminGetUserCommand({
                UserPoolId: params.userPoolId,
                Username: params.email
            })
        );

        const sub = getAttr(existing.UserAttributes, 'sub');
        if (!sub) throw new Error('Cognito user exists but is missing sub attribute');

        return { sub, created: false };
    } catch (err) {
        const e = err as { name?: string };
        if (e.name !== 'UserNotFoundException') {
            throw err;
        }
    }

    // Create user without email, then set permanent password
    const created = await client.send(
        new AdminCreateUserCommand({
            UserPoolId: params.userPoolId,
            Username: params.email,
            MessageAction: 'SUPPRESS',
            UserAttributes: [
                { Name: 'email', Value: params.email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'name', Value: params.fullName },
                { Name: 'phone_number', Value: params.phoneNumber },
                { Name: 'phone_number_verified', Value: 'true' },
                { Name: 'custom:role', Value: params.systemRole }
            ]
        })
    );

    const sub = getAttr(created.User?.Attributes, 'sub');
    if (!sub) throw new Error('Failed to read Cognito sub attribute after user creation');

    await client.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: params.userPoolId,
            Username: params.email,
            Password: params.password,
            Permanent: true
        })
    );

    return { sub, created: true };
}

async function main() {
    const userPoolId = requiredEnv('COGNITO_USER_POOL_ID');

    // Defaults are convenient for local/dev, but you should set these explicitly in CI/prod.
    const roleName = process.env.SUPER_ADMIN_ROLE_NAME || 'SUPER_ADMIN';

    const email = requiredEnv('SUPER_ADMIN_EMAIL');
    const password = requiredEnv('SUPER_ADMIN_PASSWORD');
    const fullName = requiredEnv('SUPER_ADMIN_FULL_NAME');
    const phoneNumber = requiredEnv('SUPER_ADMIN_PHONE_NUMBER');

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
        throw new Error(
            `Role ${roleName} not found in DB. Run RBAC seed first (npm run prisma:seed or npm run db:update).`
        );
    }

    const { sub, created } = await ensureCognitoUser({
        userPoolId,
        email,
        password,
        fullName,
        phoneNumber,
        systemRole: 'ADMIN'
    });

    await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
            where: { id: sub },
            update: {
                email,
                full_name: fullName,
                phone_number: phoneNumber,
                system_role: 'ADMIN',
                updated_at: new Date()
            },
            create: {
                id: sub,
                email,
                full_name: fullName,
                phone_number: phoneNumber,
                system_role: 'ADMIN',
                is_online: false
            }
        });

        await tx.userRole.upsert({
            where: {
                user_id_role_id: {
                    user_id: user.id,
                    role_id: role.id
                }
            },
            update: {},
            create: {
                user_id: user.id,
                role_id: role.id
            }
        });
    });

    console.log(
        JSON.stringify(
            {
                ok: true,
                cognito_user_created: created,
                user_id: sub,
                email,
                role_name: roleName
            },
            null,
            2
        )
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
