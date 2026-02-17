import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const AIW_ROOT_EMAIL = 'andreas.schwerla@aiw.at';
const AIW_DEPARTMENT_HEADS = [
  { email: 'zoran.franjkovic@aiw.at', name: 'Zoran Franjkovic' },
  { email: 'tomislava.cuic@aiw.at', name: 'Tomislava Cuic' },
  { email: 'lars.hoffmann@aiw.at', name: 'Lars Hoffmann' },
] as const;

async function main() {
  const password = await hash('admin123', 12);

  // Super Admin (System Architect)
  await prisma.user.upsert({
    where: { email: 'admin@mcdonalds.ba' },
    update: {},
    create: {
      email: 'admin@mcdonalds.ba',
      name: 'System Architect',
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: AIW_ROOT_EMAIL },
    update: {},
    create: {
      email: AIW_ROOT_EMAIL,
      name: 'Andreas Schwerla',
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  for (const head of AIW_DEPARTMENT_HEADS) {
    await prisma.user.upsert({
      where: { email: head.email },
      update: {},
      create: {
        email: head.email,
        name: head.name,
        password,
        role: 'ADMIN',
        isActive: true,
      },
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