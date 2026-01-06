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
