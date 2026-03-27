import { PrismaClient, DashboardNewsAttachmentKind } from '@prisma/client';
import { hash } from 'bcryptjs';
import { buildFullAdminPermissionSet } from '../lib/defaultPermissions';
import { runIamPermissionBackfill } from './backfill-iam-permissions';

const prisma = new PrismaClient();

const AIW_ROOT_EMAIL = 'andreas.schwerla@aiw.at';
const AIW_DEPARTMENT_HEADS = [
  { email: 'zoran.franjkovic@aiw.at', name: 'Zoran Franjkovic' },
  { email: 'tomislava.cuic@aiw.at', name: 'Tomislava Cuic' },
  { email: 'lars.hoffmann@aiw.at', name: 'Lars Hoffmann' },
] as const;

async function main() {
  const password = await hash('admin123', 12);

  const fullAdminPerms = buildFullAdminPermissionSet();

  await prisma.user.upsert({
    where: { email: 'admin@mcdonalds.ba' },
    update: { role: 'SYSTEM_ARCHITECT' },
    create: {
      email: 'admin@mcdonalds.ba',
      name: 'System Architect',
      password,
      role: 'SYSTEM_ARCHITECT',
      isActive: true,
      permissions: [],
    },
  });

  await prisma.user.upsert({
    where: { email: AIW_ROOT_EMAIL },
    update: { role: 'ADMIN', permissions: fullAdminPerms },
    create: {
      email: AIW_ROOT_EMAIL,
      name: 'Andreas Schwerla',
      password,
      role: 'ADMIN',
      isActive: true,
      permissions: fullAdminPerms,
    },
  });

  for (const head of AIW_DEPARTMENT_HEADS) {
    await prisma.user.upsert({
      where: { email: head.email },
      update: { role: 'ADMIN', permissions: fullAdminPerms },
      create: {
        email: head.email,
        name: head.name,
        password,
        role: 'ADMIN',
        isActive: true,
        permissions: fullAdminPerms,
      },
    });
  }

  // --- VORLAGEN: kategorije za live (upsert po imenu – bez brisanja postojećih)
  const vorlagenCategories = [
    { name: 'Formulare', description: 'Offizielle Formulare und Anträge', iconName: 'FileText' },
    { name: 'Schulungen', description: 'Unterlagen und Zertifikate für Schulungen', iconName: 'GraduationCap' },
    { name: 'Arbeitsanleitungen', description: 'Bedienungsanleitungen und Prozesse', iconName: 'BookOpen' },
    { name: 'Personal', description: 'Dokumente für Personalwesen', iconName: 'Users' },
    { name: 'Finanzen', description: 'Formulare und Vorlagen für Finanzen', iconName: 'DollarSign' },
  ];
  await runIamPermissionBackfill();

  for (const cat of vorlagenCategories) {
    const existing = await prisma.templateCategory.findFirst({ where: { name: cat.name } });
    if (!existing) {
      await prisma.templateCategory.create({
        data: {
          name: cat.name,
          description: cat.description ?? null,
          iconName: cat.iconName ?? null,
        },
      });
    }
  }

  // --- Dashboard-News: Demo-Einträge für den Startseiten-Slider (nur wenn leer)
  const dashboardNewsCount = await prisma.dashboardNewsItem.count();
  if (dashboardNewsCount === 0) {
    await prisma.dashboardNewsItem.createMany({
      data: [
        {
          title: 'Hygiene-Update Q1',
          subtitle: 'Aktualisierte Checklisten',
          coverImageUrl:
            'https://images.unsplash.com/photo-1584622650111-993a426fbf90?auto=format&fit=crop&w=560&q=80',
          attachmentUrl: '/Godisnji_Restoran%201_2026.pdf',
          attachmentKind: DashboardNewsAttachmentKind.PDF,
          sortOrder: 0,
          isActive: true,
        },
        {
          title: 'Neue Schichtplan-Richtlinie',
          subtitle: 'Gültig ab nächstem Monat',
          coverImageUrl:
            'https://images.unsplash.com/photo-1521737711867-e3b75d9d6e21?auto=format&fit=crop&w=560&q=80',
          attachmentUrl:
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
          attachmentKind: DashboardNewsAttachmentKind.IMAGE,
          sortOrder: 1,
          isActive: true,
        },
        {
          title: 'McCafé Qualitätstag',
          subtitle: 'Best Practices Barista',
          coverImageUrl:
            'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=560&q=80',
          attachmentUrl:
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
          attachmentKind: DashboardNewsAttachmentKind.IMAGE,
          sortOrder: 2,
          isActive: true,
        },
        {
          title: 'Team-Sicherheitsbriefing',
          subtitle: 'Kurzüberblick für die Schicht',
          coverImageUrl:
            'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=560&q=80',
          attachmentUrl:
            'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1200&q=80',
          attachmentKind: DashboardNewsAttachmentKind.IMAGE,
          sortOrder: 3,
          isActive: true,
        },
      ],
    });
  }

  // --- Dashboard-Events: Demo-Einträge für den unteren Slider (nur wenn leer)
  const dashboardEventsCount = await prisma.dashboardEventItem.count();
  if (dashboardEventsCount === 0) {
    const demoEvents = [
      {
        title: 'Teambuilding',
        subtitle: 'März 2026',
        coverImageUrl:
          'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=960&q=80',
        sortOrder: 0,
        images: [
          'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80',
        ],
      },
      {
        title: 'Restaurant Umbau',
        subtitle: '2025',
        coverImageUrl:
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=960&q=80',
        sortOrder: 1,
        images: [
          'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1461988625982-7e46a099bf4f?auto=format&fit=crop&w=1400&q=80',
        ],
      },
      {
        title: 'Crew Challenge',
        subtitle: 'Winter Cup',
        coverImageUrl:
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=960&q=80',
        sortOrder: 2,
        images: [
          'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1514516870926-205989dbf2ec?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
        ],
      },
      {
        title: 'McCafé Relaunch',
        subtitle: 'Neugestaltung',
        coverImageUrl:
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=960&q=80',
        sortOrder: 3,
        images: [
          'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=1400&q=80',
          'https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=1400&q=80',
        ],
      },
    ];

    for (const event of demoEvents) {
      await prisma.dashboardEventItem.create({
        data: {
          title: event.title,
          subtitle: event.subtitle,
          coverImageUrl: event.coverImageUrl,
          sortOrder: event.sortOrder,
          isActive: true,
          images: {
            create: event.images.slice(0, 10).map((imageUrl, idx) => ({
              imageUrl,
              sortOrder: idx,
            })),
          },
        },
      });
    }
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