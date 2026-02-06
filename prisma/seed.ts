import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Očisti postojeće usere (opcionalno, za clean start)
  // await prisma.user.deleteMany(); 

  // 2. Hashiraj lozinku
  const password = await hash('admin123', 12); // Tvoja privremena šifra

  // 3. Kreiraj Super Admina
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mcdonalds.ba' },
    update: {}, // Ako postoji, ne diraj ga
    create: {
      email: 'admin@mcdonalds.ba',
      name: 'System Architect',
      password,
      role: 'SUPER_ADMIN',
      isActive: true,
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