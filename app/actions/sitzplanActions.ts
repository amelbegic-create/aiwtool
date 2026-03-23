"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { cookies } from "next/headers";
import { mergeSitzplanPdfs, SITZPLAN_MAX_FILES, type SitzplanPdfEntry } from "@/lib/sitzplanUrls";

async function resolveRestaurantIdForSessionUser(sessionUserId: string) {
  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  if (activeRestaurantId && activeRestaurantId !== "all") return activeRestaurantId;

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { restaurants: { select: { restaurantId: true, isPrimary: true } } },
  });

  const primary = user?.restaurants.find((r) => r.isPrimary)?.restaurantId;
  if (primary) return primary;

  const first = user?.restaurants[0]?.restaurantId;
  if (first) return first;

  return null;
}

/** Eksplicitan select (bez spreada) – izbjegava PrismaClientValidationError. */
const sitzplanRestaurantSelect = {
  sitzplanPdfUrl: true,
  sitzplanPdfsData: true,
} as const;

function revalidateSitzplanPaths() {
  revalidatePath("/admin/sitzplan");
  revalidatePath("/tools/restaurants");
  revalidatePath("/tools/sitzplan");
  revalidatePath("/tools/sitzplan/waehlen");
}

function persistEntries(entries: SitzplanPdfEntry[]): Prisma.RestaurantUpdateInput {
  const json = entries.map((e) => ({ url: e.url, fileName: e.fileName })) as Prisma.InputJsonValue;
  return {
    sitzplanPdfUrl: null,
    sitzplanPdfsData: json,
  };
}

/** Admin: weiteres Sitzplan-PDF hochladen (max. 5). */
export async function uploadSitzplan(restaurantId: string, formData: FormData) {
  await requirePermission("restaurants:access");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("Bitte wählen Sie eine PDF-Datei aus.");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, ...sitzplanRestaurantSelect },
  });
  if (!restaurant) throw new Error("Restaurant nicht gefunden.");

  const current = mergeSitzplanPdfs(restaurant);
  if (current.length >= SITZPLAN_MAX_FILES) {
    throw new Error(`Maximal ${SITZPLAN_MAX_FILES} Sitzplan-PDFs erlaubt.`);
  }

  const blob = await put(`sitzplan/${restaurantId}-${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const next: SitzplanPdfEntry[] = [...current, { url: blob.url, fileName: file.name }];

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: persistEntries(next),
  });

  revalidateSitzplanPaths();
  revalidatePath(`/admin/sitzplan/${restaurantId}`);
  return { url: blob.url };
}

/** Admin: alle Sitzplan-PDFs löschen */
export async function deleteSitzplan(restaurantId: string) {
  await requirePermission("restaurants:access");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: sitzplanRestaurantSelect,
  });
  if (!restaurant) throw new Error("Restaurant nicht gefunden.");

  const items = mergeSitzplanPdfs(restaurant);
  for (const e of items) {
    try {
      await del(e.url);
    } catch (err) {
      console.error("Fehler beim Löschen von Vercel Blob:", err);
    }
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      sitzplanPdfUrl: null,
      sitzplanPdfsData: [],
    },
  });

  revalidateSitzplanPaths();
  revalidatePath(`/admin/sitzplan/${restaurantId}`);
}

/** Admin: ein einzelnes PDF nach Index entfernen (merged Liste) */
export async function deleteSitzplanAt(restaurantId: string, index: number) {
  await requirePermission("restaurants:access");

  if (index < 0 || !Number.isInteger(index)) throw new Error("Ungültiger Index.");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: sitzplanRestaurantSelect,
  });
  if (!restaurant) throw new Error("Restaurant nicht gefunden.");

  const items = mergeSitzplanPdfs(restaurant);
  if (index >= items.length) throw new Error("Datei nicht gefunden.");

  const removed = items[index];
  const next = items.filter((_, i) => i !== index);

  try {
    await del(removed.url);
  } catch (err) {
    console.error("Fehler beim Löschen von Vercel Blob:", err);
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: persistEntries(next),
  });

  revalidateSitzplanPaths();
  revalidatePath(`/admin/sitzplan/${restaurantId}`);
}

/** Korisnik: merged Sitzplan-Einträge za aktivni restoran */
export async function getSitzplanForUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return null;

  const restaurantId = await resolveRestaurantIdForSessionUser(user.id);
  if (!restaurantId) return null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      name: true,
      sitzplanPdfUrl: true,
      sitzplanPdfsData: true,
    },
  });

  if (!restaurant) return null;

  const sitzplanPdfs = mergeSitzplanPdfs(restaurant);
  return {
    restaurantName: restaurant.name ?? restaurantId,
    sitzplanPdfs,
  };
}
