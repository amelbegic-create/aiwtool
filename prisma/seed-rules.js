// prisma/seed-rules.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Nađemo jedan restoran (prvi aktivni)
  const restaurant = await prisma.restaurant.findFirst({
    where: { isActive: true },
  });

  if (!restaurant) {
    console.log("Nema nijednog restorana u bazi. Prvo pokreni glavni seed.");
    return;
  }

  // Kategorije
  const hygiene = await prisma.ruleCategory.upsert({
    where: { slug: "higijena" },
    update: {},
    create: {
      name: "Higijena",
      slug: "higijena",
      description: "Pravila čišćenja i održavanja prostora i opreme.",
      icon: "broom",
    },
  });

  const kitchen = await prisma.ruleCategory.upsert({
    where: { slug: "kuhinja" },
    update: {},
    create: {
      name: "Kuhinja",
      slug: "kuhinja",
      description: "Pravila rada s roštiljem, fritezama i pripremom hrane.",
      icon: "flame",
    },
  });

  // PRAVILO 1 – Čišćenje salona
  const cleaningRule = await prisma.rule.create({
    data: {
      title: "Čišćenje salona za goste",
      summary:
        "Postupak čišćenja stola, podova i opreme u sali za goste nakon svake smjene.",
      content:
        "1. Ukloniti otpad sa stolova i podova.\n2. Obrisati sve stolove sredstvom za dezinfekciju.\n3. Usisati ili počistiti podove odgovarajućim sredstvom.\n4. Provjeriti čistoću samouslužnih zona (ketchup, slamke, salvete).\n5. Evidentirati završen zadatak u odgovarajućoj checklisti.",
      categoryId: hygiene.id,
      restaurantId: restaurant.id,
      isActive: true,
      isGlobal: false,
    },
  });

  await prisma.ruleMedia.createMany({
    data: [
      {
        ruleId: cleaningRule.id,
        type: "IMAGE",
        url: "/images/rules/cleaning-salon-1.jpg",
        title: "Primjer pravilno očišćenog stola",
        order: 1,
      },
      {
        ruleId: cleaningRule.id,
        type: "VIDEO",
        url: "https://www.youtube.com/watch?v=dummy-cleaning-video",
        title: "Video – čišćenje salona",
        order: 2,
      },
    ],
  });

  // PRAVILO 2 – Čišćenje roštilja
  await prisma.rule.create({
    data: {
      title: "Čišćenje roštilja na kraju smjene",
      summary:
        "Standardizirani postupak gašenja, hlađenja i čišćenja roštilja na kraju svake smjene.",
      content:
        "1. Isključiti opremu i ostaviti da se ohladi prema uputama proizvođača.\n2. Ukloniti rešetke i staviti ih u odgovarajuću posudu za namakanje.\n3. Mehanički ukloniti ostatke hrane s grijaćih površina.\n4. Nanijeti odobreno sredstvo za čišćenje i isprati prema proceduri.\n5. Sastaviti opremu i provjeriti čistoću.\n6. Potpisati se u knjigu čišćenja opreme.",
      categoryId: kitchen.id,
      restaurantId: restaurant.id,
      isActive: true,
      isGlobal: false,
    },
  });

  console.log("Rules seed završen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
