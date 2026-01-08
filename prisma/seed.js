// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // 1) Hash lozinke za admina
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  // 2) Kreiraj (ili nađi) admin korisnika
  const admin = await prisma.user.upsert({
    where: { email: "admin@mcdtoolat.local" },
    update: {},
    create: {
      email: "admin@mcdtoolat.local",
      name: "System Admin",
      role: "ADMIN",
      password: passwordHash,
    },
  });

  // 3) Kreiraj (ili nađi) test restoran
  const rest1 = await prisma.restaurant.upsert({
    where: { code: "AT001" },
    update: {},
    create: {
      name: "MCD AT001",
      code: "AT001",
    },
  });

  // 4) Poveži admina s tim restoranom
  await prisma.userRestaurant.upsert({
    where: {
      userId_restaurantId: {
        userId: admin.id,
        restaurantId: rest1.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      restaurantId: rest1.id,
    },
  });

  console.log("✅ Seed gotov: admin + restoran ubačeni.");
}

main()
  .catch((e) => {
    console.error("❌ Greška u seed skripti:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
