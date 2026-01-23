/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { RulePriority, RuleStatus } from "@prisma/client";
import { put } from "@vercel/blob";

export interface RuleFormData {
  id?: string;
  title: string;
  categoryId: string;
  priority: RulePriority;
  content: string;
  videoUrl?: string;
  pdfUrls: string[];
  isGlobal: boolean;
  restaurantIds: string[];
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
  let whereClause: any = { ...statusFilter };

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

  return rules.map((r: any) => ({
    ...r,
    isRead: r.readReceipts && r.readReceipts.length > 0
  }));
}

export async function saveRule(data: RuleFormData, imageUrls: string[] = []) {
    const user = await checkAdmin();

    const commonData = {
        title: data.title,
        content: data.content,
        priority: data.priority,
        videoUrl: data.videoUrl,
        pdfUrls: data.pdfUrls,
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
    return { success: true };
}

export async function toggleRuleStatus(id: string, currentStatus: boolean) {
    await checkAdmin();
    await prisma.rule.update({ where: { id }, data: { isActive: !currentStatus } });
    revalidatePath('/tools/rules');
}

export async function deleteRule(id: string) {
    await checkAdmin();
    await prisma.rule.delete({ where: { id } });
    revalidatePath('/tools/rules');
}

export async function markRuleAsRead(ruleId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return;

    try {
        await prisma.ruleReadReceipt.create({ data: { ruleId, userId: user.id } });
        revalidatePath('/tools/rules');
    } catch (e) {} 
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