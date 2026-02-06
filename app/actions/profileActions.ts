"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { hash, compare } from "bcryptjs";

type SessionUser = { id?: string; email?: string | null };

async function requireSessionUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as SessionUser)?.id;
  if (!id) throw new Error("Niste prijavljeni.");
  return id;
}

/** Upload avatar na Vercel Blob i spremi URL u user.image. Vraća novi URL. */
export async function uploadAvatar(formData: FormData): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const userId = await requireSessionUserId();
    const file = formData.get("file") as File | null;
    if (!file?.size) return { success: false, error: "Nijedan fajl nije odabran." };

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { success: false, error: "Blob token nije konfiguriran." };

    const blob = await put(`avatars/${userId}-${Date.now()}.${file.name.split(".").pop() || "jpg"}`, file, {
      access: "public",
      token,
      addRandomSuffix: true,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { image: blob.url },
    });

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true, url: blob.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Greška pri uploadu.";
    return { success: false, error: message };
  }
}

/** Spremi URL avatara u bazu (koristi se nakon client-side Blob uploada ako želimo samo snimiti već uploadani URL). */
export async function updateAvatar(url: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await requireSessionUserId();
    await prisma.user.update({
      where: { id: userId },
      data: { image: url },
    });
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Greška pri ažuriranju avatara.";
    return { success: false, error: message };
  }
}

/** Ažuriraj ime i email (lični podaci). */
export async function updateProfile(data: { name?: string; email?: string }): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await requireSessionUserId();
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();

    const updateData: { name?: string | null; email?: string } = {};
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) {
      if (!email) return { success: false, error: "Email je obavezan." };
      const existing = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
      if (existing) return { success: false, error: "Taj email već koristi drugi korisnik." };
      updateData.email = email;
    }

    if (Object.keys(updateData).length === 0) return { success: true };

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Greška pri ažuriranju profila.";
    return { success: false, error: message };
  }
}

/** Promjena lozinke: provjera stare (bcrypt), hash nove, snimi. */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await requireSessionUserId();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user?.password) return { success: false, error: "Korisnik nije pronađen ili nema lozinku." };

    const valid = await compare(currentPassword, user.password);
    if (!valid) return { success: false, error: "Trenutna lozinka nije ispravna." };

    const trimmed = newPassword.trim();
    if (trimmed.length < 6) return { success: false, error: "Nova lozinka mora imati najmanje 6 znakova." };

    const hashed = await hash(trimmed, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    revalidatePath("/profile");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Greška pri promjeni lozinke.";
    return { success: false, error: message };
  }
}
