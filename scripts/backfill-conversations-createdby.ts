import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Prefer direct connection for one-off scripts (pooler can be unavailable / rate-limited)
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

type Stats = {
  convUpdated: number;
  itemUpdated: number;
};

async function main() {
  const stats: Stats = { convUpdated: 0, itemUpdated: 0 };

  // 1) Backfill conversations: createdById := requesterUserId (safe default)
  const convs = await prisma.oneOnOneConversation.findMany({
    where: { createdById: null },
    select: { id: true, requesterUserId: true },
    take: 5000,
  });

  for (const c of convs) {
    await prisma.oneOnOneConversation.update({
      where: { id: c.id },
      data: { createdById: c.requesterUserId },
    });
    stats.convUpdated += 1;
  }

  // 2) Backfill items: createdById := conversation.createdById (or requesterUserId as fallback)
  const items = await prisma.oneOnOneConversationItem.findMany({
    where: { createdById: null },
    select: {
      id: true,
      conversation: { select: { createdById: true, requesterUserId: true } },
    },
    take: 20000,
  });

  for (const it of items) {
    const fallback = it.conversation.createdById ?? it.conversation.requesterUserId;
    await prisma.oneOnOneConversationItem.update({
      where: { id: it.id },
      data: { createdById: fallback },
    });
    stats.itemUpdated += 1;
  }

  const [remainingConvs, remainingItems] = await Promise.all([
    prisma.oneOnOneConversation.count({ where: { createdById: null } }),
    prisma.oneOnOneConversationItem.count({ where: { createdById: null } }),
  ]);

  // eslint-disable-next-line no-console
  console.log({
    ok: true,
    ...stats,
    remainingConvs,
    remainingItems,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

