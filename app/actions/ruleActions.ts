"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { RulePriority, RuleStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";

export interface RuleFormData {
  id?: string;
  title: string;
  categoryId: string;
  priority: RulePriority;
  content: string;
  videoUrl?: string;
  pdfUrls: string[];
  imageUrl?: string | null;
  isGlobal: boolean;
  restaurantIds: string[];
}

export interface RuleStatsUser {
  id: string;
  name: string | null;
  email: string | null;
  readAt?: string;
}

export interface RuleStatsResult {
  read: RuleStatsUser[];
  unread: RuleStatsUser[];
}

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  
  const allowed = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'];
  // FIX: Cast u string da izbjegnemo TS greške
  if (!allowed.includes(user.role as string)) {
      throw new Error("Forbidden");
  }
  return user;
}

export async function getCategories() {
    return await prisma.ruleCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(name: string) {
    await checkAdmin();
    await prisma.ruleCategory.create({ data: { name } });
    revalidatePath('/tools/rules');
}

export async function deleteCategory(id: string) {
    await checkAdmin();
    const count = await prisma.rule.count({ where: { categoryId: id }});
    if(count > 0) throw new Error("Kategorija nije prazna.");
    await prisma.ruleCategory.delete({ where: { id } });
    revalidatePath('/tools/rules');
}

export async function getRules(restaurantId?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const user = await prisma.user.findUnique({ 
    where: { email: session.user.email },
    include: { restaurants: true }
  });
  if (!user) return [];

  const isBoss = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role as string);

  const statusFilter = isBoss ? {} : { isActive: true };
  let whereClause: Prisma.RuleWhereInput = { ...statusFilter };

  if (!isBoss) {
    const userRestaurantIds = user.restaurants.map(r => r.restaurantId);
    whereClause = {
        ...whereClause,
        OR: [
            { isGlobal: true },
            { restaurants: { some: { restaurantId: { in: userRestaurantIds } } } }
        ]
    };
  } else if (restaurantId && restaurantId !== 'all') {
      whereClause = {
          ...whereClause,
          OR: [
              { isGlobal: true },
              { restaurants: { some: { restaurantId } } }
          ]
      }
  }

  const rules = await prisma.rule.findMany({
    where: whereClause,
    include: {
      category: true,
      images: true,
      restaurants: true,
      readReceipts: { where: { userId: user.id } }
    },
    orderBy: { createdAt: 'desc' }
  });

  type RuleWithMeta = (typeof rules)[number] & { isRead: boolean };
  return rules.map((r): RuleWithMeta => ({
    ...r,
    isRead: r.readReceipts != null && r.readReceipts.length > 0,
  }));
}

export type RuleListItem = Awaited<ReturnType<typeof getRules>>[number];

export async function saveRule(data: RuleFormData, imageUrls: string[] = []) {
    const user = await checkAdmin();

    const commonData = {
        title: data.title,
        content: data.content,
        priority: data.priority,
        videoUrl: data.videoUrl,
        pdfUrls: data.pdfUrls,
        imageUrl: data.imageUrl ?? undefined,
        isGlobal: data.isGlobal,
        categoryId: data.categoryId,
    };

    if (data.id) {
        await prisma.rule.update({ where: { id: data.id }, data: commonData });
        
        await prisma.ruleRestaurant.deleteMany({ where: { ruleId: data.id } });
        if (!data.isGlobal && data.restaurantIds.length > 0) {
            await prisma.ruleRestaurant.createMany({
                data: data.restaurantIds.map(rid => ({ ruleId: data.id!, restaurantId: rid }))
            });
        }

        if (imageUrls.length > 0) {
            await prisma.ruleImage.createMany({
                data: imageUrls.map(url => ({ url, ruleId: data.id! }))
            });
        }
    } else {
        const newRule = await prisma.rule.create({
            data: {
                ...commonData,
                authorId: user.id,
                isActive: true,
                status: 'ACTIVE' as RuleStatus,
                images: { create: imageUrls.map(url => ({ url })) }
            }
        });

        if (!data.isGlobal && data.restaurantIds.length > 0) {
            await prisma.ruleRestaurant.createMany({
                data: data.restaurantIds.map(rid => ({ ruleId: newRule.id, restaurantId: rid }))
            });
        }
    }
    revalidatePath('/tools/rules');
    revalidatePath('/admin/rules');
    return { success: true };
}

export async function toggleRuleStatus(id: string, currentStatus: boolean) {
    await checkAdmin();
    await prisma.rule.update({ where: { id }, data: { isActive: !currentStatus } });
    revalidatePath('/tools/rules');
    revalidatePath('/admin/rules');
}

export async function deleteRule(id: string) {
    await checkAdmin();
    await prisma.rule.delete({ where: { id } });
    revalidatePath('/tools/rules');
    revalidatePath('/admin/rules');
}

export async function markRuleAsRead(ruleId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return;

    try {
        await prisma.ruleReadReceipt.create({ data: { ruleId, userId: user.id } });
        revalidatePath('/tools/rules');
    } catch {} 
}

export async function getRuleStats(ruleId: string): Promise<RuleStatsResult> {
  await checkAdmin();
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { readReceipts: { include: { user: { select: { id: true, name: true, email: true } } } }, restaurants: true },
  });
  if (!rule) return { read: [], unread: [] };

  const readUserIds = new Set(rule.readReceipts.map((r) => r.userId));
  const read: RuleStatsUser[] = rule.readReceipts.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    readAt: r.readAt.toISOString(),
  }));

  if (rule.isGlobal) {
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
    });
    const unread = allUsers.filter((u) => !readUserIds.has(u.id)).map((u) => ({ id: u.id, name: u.name, email: u.email }));
    return { read, unread };
  }

  const restaurantIds = rule.restaurants.map((rr) => rr.restaurantId);
  const relations = await prisma.restaurantUser.findMany({
    where: { restaurantId: { in: restaurantIds } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const unreadUserIds = new Map<string, { id: string; name: string | null; email: string | null }>();
  for (const r of relations) {
    if (!readUserIds.has(r.userId)) unreadUserIds.set(r.userId, r.user);
  }
  const unread = Array.from(unreadUserIds.values());
  return { read, unread };
}

export async function getRuleStatsSummary(ruleId: string): Promise<{ readCount: number; totalCount: number }> {
  const result = await getRuleStats(ruleId);
  const readCount = result.read.length;
  const totalCount = result.read.length + result.unread.length;
  return { readCount, totalCount };
}

export async function uploadFile(formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Unauthorized");
    
    const file = formData.get('file') as File;
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if(!token) throw new Error("Token missing");

    // FIX: addRandomSuffix true da se izbjegne greška "Blob already exists"
    const blob = await put(file.name, file, { 
        access: 'public', 
        token,
        addRandomSuffix: true 
    });
    return blob.url;
}