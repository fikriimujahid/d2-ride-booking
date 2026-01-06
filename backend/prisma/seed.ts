import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create Permissions
  const permissions = [
    'rides.create',
    'rides.view',
    'rides.update',
    'rides.delete',
    'drivers.create',
    'drivers.view',
    'drivers.update',
    'drivers.delete',
    'passengers.create',
    'passengers.view',
    'passengers.update',
    'passengers.delete',
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm },
      update: {},
      create: {
        name: perm,
        description: `Permission for ${perm}`,
      },
    });
  }

  // 2. Create Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Super Administrator with all permissions' },
    { name: 'DRIVER', description: 'Driver role' },
    { name: 'PASSENGER', description: 'Passenger role' },
    { name: 'OPERATIONS_MANAGER', description: 'Operations Manager role' },
  ];

  const createdRoles = [];
  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: roleData,
    });
    createdRoles.push(role);
  }

  // 3. Assign Permissions to Roles (Example logic)
  // Give SUPER_ADMIN all permissions
  const superAdminRole = createdRoles.find((r) => r.name === 'SUPER_ADMIN');
  if (superAdminRole) {
    const allPermissions = await prisma.permission.findMany();
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // Give DRIVER specific permissions
  const driverRole = createdRoles.find((r) => r.name === 'DRIVER');
  if (driverRole) {
    const driverPerms = await prisma.permission.findMany({
      where: {
        OR: [{ name: { startsWith: 'rides.' } }, { name: { startsWith: 'drivers.' } }],
      },
    });
    for (const perm of driverPerms) {
       await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: driverRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: driverRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  // Give PASSENGER specific permissions
  const passengerRole = createdRoles.find((r) => r.name === 'PASSENGER');
  if (passengerRole) {
    const passengerPerms = await prisma.permission.findMany({
      where: {
        OR: [{ name: { startsWith: 'rides.' } }, { name: { startsWith: 'passengers.' } }],
      },
    });
    for (const perm of passengerPerms) {
       await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: passengerRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: passengerRole.id,
          permissionId: perm.id,
        },
      });
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
