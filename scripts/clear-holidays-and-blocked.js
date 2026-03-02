const { PrismaClient } = require("../node_modules/@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const blockedResult = await prisma.blockedDay.deleteMany();
    const holidayResult = await prisma.holiday.deleteMany();
    console.log("BlockedDay deleted:", blockedResult.count);
    console.log("Holiday deleted:", holidayResult.count);
  } catch (e) {
    console.error("Error while deleting holidays/blocked days:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

