import { PrismaClient } from '@prisma/client';
import { Permissions, RolePermissions } from '../src/config/rbac.config';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding RBAC...');

    // 1. Seed Permissions
    for (const [key, value] of Object.entries(Permissions)) {
        await prisma.permission.upsert({
            where: { key: value },
            update: {},
            create: {
                key: value,
                description: `Permission for ${key}`
            }
        });
    }

    // 2. Seed Roles and Assign Permissions
    for (const [roleName, permissions] of Object.entries(RolePermissions)) {
        // Seed ALL roles present in RolePermissions, including system roles like PASSENGER/DRIVER/ADMIN.

        console.log(`Processing Role: ${roleName}`);

        const role = await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: {
                name: roleName,
                description: `Role for ${roleName}`
            }
        });

        // Assign Permissions
        for (const permKey of permissions) {
            if (permKey === '*') {
                // Handle ALL_ACCESS - maybe assign all permissions?
                // For now, let's assume '*' is a special permission key we created or we assign all existing keys.
                // Or we just insert a permission with key '*'.
                await prisma.permission.upsert({
                    where: { key: '*' },
                    update: {},
                    create: { key: '*', description: 'All Access' }
                });
            }

            const permission = await prisma.permission.findUnique({
                where: { key: permKey }
            });

            if (permission) {
                // Create RolePermission
                await prisma.rolePermission.upsert({
                    where: {
                        role_id_permission_id: {
                            role_id: role.id,
                            permission_id: permission.id
                        }
                    },
                    update: {},
                    create: {
                        role_id: role.id,
                        permission_id: permission.id
                    }
                });
            }
        }
    }

    console.log('RBAC Seeding Completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
