"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { cookies } from "next/headers";

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

/** Admin: Upload Sitzplan PDF za restoran */
export async function uploadSitzplan(restaurantId: string, formData: FormData) {
  await requirePermission("restaurants:access");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("Bitte wählen Sie eine PDF-Datei aus.");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, sitzplanPdfUrl: true },
  });
  if (!restaurant) throw new Error("Restaurant nicht gefunden.");

  // Obriši stari fajl ako postoji
  if (restaurant.sitzplanPdfUrl) {
    try {
      await del(restaurant.sitzplanPdfUrl);
    } catch (err) {
      console.error("Fehler beim Löschen der alten Datei:", err);
    }
  }

  const blob = await put(`sitzplan/${restaurantId}-${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { sitzplanPdfUrl: blob.url },
  });

  revalidatePath("/admin/sitzplan");
  revalidatePath("/tools/restaurants");
  return { url: blob.url };
}

/** Admin: Obriši Sitzplan PDF */
export async function deleteSitzplan(restaurantId: string) {
  await requirePermission("restaurants:access");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { sitzplanPdfUrl: true },
  });
  if (!restaurant) throw new Error("Restaurant nicht gefunden.");

  if (restaurant.sitzplanPdfUrl) {
    try {
      await del(restaurant.sitzplanPdfUrl);
    } catch (err) {
      console.error("Fehler beim Löschen von Vercel Blob:", err);
    }
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { sitzplanPdfUrl: null },
  });

  revalidatePath("/admin/sitzplan");
  revalidatePath("/tools/restaurants");
}

/** Korisnik: Dohvati sitzplanPdfUrl za restoran u kojem je prijavljen */
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
    select: { name: true, sitzplanPdfUrl: true },
  });

  return restaurant
    ? { restaurantName: restaurant.name ?? restaurantId, sitzplanPdfUrl: restaurant.sitzplanPdfUrl }
    : null;
}
