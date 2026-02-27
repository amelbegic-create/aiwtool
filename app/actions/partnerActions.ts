"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { requirePermission } from "@/lib/access";
import { hasPermission } from "@/lib/access";
import { put } from "@vercel/blob";

export type PartnerContactInput = {
  id?: string;
  contactName: string;
  phone?: string;
  email?: string;
  role?: string;
};

export type PartnerCompanyInput = {
  categoryId: string;
  companyName: string;
  logoUrl?: string | null;
  serviceDescription?: string;
  notes?: string;
  websiteUrl?: string;
  priceListPdfUrl?: string | null;
  galleryUrls?: string[];
  contacts: PartnerContactInput[];
};

export async function getPartners() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, permissions: true },
  });
  if (!user) return [];

  const canAccess =
    hasPermission(String(user.role), user.permissions || [], "partners:access") ||
    hasPermission(String(user.role), user.permissions || [], "partners:manage");
  if (!canAccess) return [];

  return prisma.partnerCompany.findMany({
    orderBy: { companyName: "asc" },
    include: { contacts: true, category: true },
  });
}

export async function getPartnerById(id: string) {
  await requirePermission("partners:manage");
  return prisma.partnerCompany.findUnique({
    where: { id },
    include: { contacts: true, category: true },
  });
}

const DEFAULT_CATEGORIES = [
  { name: "IT", icon: "Cpu" },
  { name: "Haus Technik", icon: "Wrench" },
  { name: "Ostalo", icon: "Folder" },
  { name: "Uprava", icon: "ClipboardList" },
];

export async function getPartnerCategories() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, permissions: true },
  });
  if (!user) return [];
  const canAccess =
    hasPermission(String(user.role), user.permissions || [], "partners:access") ||
    hasPermission(String(user.role), user.permissions || [], "partners:manage");
  if (!canAccess) return [];

  let list = await prisma.partnerCategoryModel.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (list.length === 0) {
    await prisma.partnerCategoryModel.createMany({
      data: DEFAULT_CATEGORIES.map(({ name, icon }, i) => ({ name, icon, sortOrder: i })),
    });
    list = await prisma.partnerCategoryModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  return list;
}

async function checkPartnersManage() {
  await requirePermission("partners:manage");
}

/** Upload logo/naslovnice partnera na Vercel Blob. Vraća URL (ne sprema u bazu – forma šalje URL pri create/update). */
export async function uploadPartnerLogo(
  formData: FormData
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await checkPartnersManage();
    const file = formData.get("file") as File | null;
    if (!file?.size) return { success: false, error: "Nije odabrana datoteka." };
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { success: false, error: "Blob token nije konfiguriran." };
    const ext = file.name.split(".").pop() || "jpg";
    const blob = await put(`partners/logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, file, {
      access: "public",
      token,
      addRandomSuffix: true,
    });
    return { success: true, url: blob.url };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Greška pri uploadu." };
  }
}

/** Upload jedne slike u galeriju partnera. Radi slično kao uploadPartnerLogo, ali u posebnu putanju. */
export async function uploadPartnerGalleryImage(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await checkPartnersManage();
    const file = formData.get("file") as File | null;
    if (!file?.size) return { success: false, error: "Nije odabrana datoteka." };
    if (!file.type.startsWith("image/")) return { success: false, error: "Dozvoljene su samo slike." };
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { success: false, error: "Blob token nije konfiguriran." };
    const ext = file.name.split(".").pop() || "jpg";
    const blob = await put(
      `partners/gallery/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
      file,
      {
        access: "public",
        token,
        addRandomSuffix: true,
      },
    );
    return { success: true, url: blob.url };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Greška pri uploadu slike." };
  }
}

/** Upload cjenovnika (PDF) za partnera. */
export async function uploadPartnerPriceListPdf(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await checkPartnersManage();
    const file = formData.get("file") as File | null;
    if (!file?.size) return { success: false, error: "Nije odabrana datoteka." };
    if (file.type !== "application/pdf")
      return { success: false, error: "Dozvoljen je samo PDF (cjenovnik)." };
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { success: false, error: "Blob token nije konfiguriran." };
    const name = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const blob = await put(
      `partners/pricelist/${Date.now()}-${name}`,
      file,
      { access: "public", token, addRandomSuffix: true },
    );
    return { success: true, url: blob.url };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Greška pri uploadu PDF-a." };
  }
}

export async function createPartnerCategory(name: string, icon?: string | null) {
  await checkPartnersManage();
  if (!name?.trim()) throw new Error("Naziv kategorije je obavezan.");
  const max = await prisma.partnerCategoryModel.aggregate({ _max: { sortOrder: true } });
  await prisma.partnerCategoryModel.create({
    data: {
      name: name.trim(),
      icon: icon?.trim() || null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/categories");
  revalidatePath("/tools/partners");
}

export async function updatePartnerCategory(id: string, name: string, icon?: string | null) {
  await checkPartnersManage();
  if (!name?.trim()) throw new Error("Naziv kategorije je obavezan.");
  const data: { name: string; icon?: string | null } = { name: name.trim() };
  if (icon !== undefined) data.icon = icon?.trim() || null;
  await prisma.partnerCategoryModel.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/categories");
  revalidatePath("/tools/partners");
}

export async function deletePartnerCategory(id: string) {
  await checkPartnersManage();
  const count = await prisma.partnerCompany.count({ where: { categoryId: id } });
  if (count > 0) throw new Error("Kategorija se koristi kod firmi. Prvo premjestite firme u drugu kategoriju.");
  await prisma.partnerCategoryModel.delete({ where: { id } });
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/categories");
  revalidatePath("/tools/partners");
}

export async function createPartner(data: PartnerCompanyInput) {
  await checkPartnersManage();

  if (!data.companyName?.trim()) throw new Error("Naziv firme je obavezan.");
  if (!data.categoryId?.trim()) throw new Error("Kategorija je obavezna.");

  await prisma.partnerCompany.create({
    data: {
      categoryId: data.categoryId.trim(),
      companyName: data.companyName.trim(),
      logoUrl: data.logoUrl?.trim() || null,
      serviceDescription: data.serviceDescription?.trim() || null,
      notes: data.notes?.trim() || null,
      websiteUrl: data.websiteUrl?.trim() || null,
      priceListPdfUrl: data.priceListPdfUrl?.trim() || null,
      galleryUrls: data.galleryUrls && data.galleryUrls.length > 0
        ? data.galleryUrls.map((u) => u.trim()).filter(Boolean)
        : [],
      contacts: {
        create: (data.contacts || [])
          .filter((c) => c.contactName?.trim())
          .map((c) => ({
            contactName: c.contactName.trim(),
            phone: c.phone?.trim() || null,
            email: c.email?.trim() || null,
            role: c.role?.trim() || null,
          })),
      },
    },
  });

  revalidatePath("/admin/partners");
  revalidatePath("/tools/partners");
}

export async function updatePartner(id: string, data: PartnerCompanyInput) {
  await checkPartnersManage();

  if (!data.companyName?.trim()) throw new Error("Naziv firme je obavezan.");
  if (!data.categoryId?.trim()) throw new Error("Kategorija je obavezna.");

  await prisma.$transaction(async (tx) => {
    await tx.partnerContact.deleteMany({ where: { partnerCompanyId: id } });
    await tx.partnerCompany.update({
      where: { id },
      data: {
        category: data.categoryId?.trim()
          ? { connect: { id: data.categoryId.trim() } }
          : { disconnect: true },
        companyName: data.companyName.trim(),
        logoUrl: data.logoUrl !== undefined ? (data.logoUrl?.trim() || null) : undefined,
        serviceDescription: data.serviceDescription?.trim() || null,
        notes: data.notes?.trim() || null,
        websiteUrl: data.websiteUrl !== undefined ? (data.websiteUrl?.trim() || null) : undefined,
        priceListPdfUrl: data.priceListPdfUrl !== undefined ? (data.priceListPdfUrl?.trim() || null) : undefined,
        galleryUrls: data.galleryUrls
          ? data.galleryUrls.map((u) => u.trim()).filter(Boolean)
          : undefined,
      },
    });
    const validContacts = (data.contacts || []).filter((c) => c.contactName?.trim());
    if (validContacts.length > 0) {
      await tx.partnerContact.createMany({
        data: validContacts.map((c) => ({
          partnerCompanyId: id,
          contactName: c.contactName.trim(),
          phone: c.phone?.trim() || null,
          email: c.email?.trim() || null,
          role: c.role?.trim() || null,
        })),
      });
    }
  });

  revalidatePath("/admin/partners");
  revalidatePath("/tools/partners");
}

export async function deletePartner(id: string) {
  await checkPartnersManage();

  await prisma.partnerCompany.delete({ where: { id } });

  revalidatePath("/admin/partners");
  revalidatePath("/tools/partners");
}
