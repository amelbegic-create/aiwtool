"use server";

import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { Resend } from "resend";
import { getPasswordResetEmailHtml } from "@/lib/passwordResetEmail";

const TOKEN_BYTES = 32;
const EXPIRES_HOURS = 1;

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  );
}

/**
 * Request password reset: check email, create token, send email via Resend.
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, error: "E-Mail ist erforderlich." };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.isActive) {
    return { success: true };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "E-Mail-Dienst ist nicht konfiguriert. Bitte Administrator kontaktieren." };
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expires = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { email: normalizedEmail } });
  await prisma.passwordResetToken.create({ data: { email: normalizedEmail, token, expires } });

  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/auth/new-password?token=${token}`;
  const html = getPasswordResetEmailHtml(resetUrl);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [normalizedEmail],
      subject: "AIW Services – Passwort zurücksetzen",
      html,
    });
    if (error) {
      return { success: false, error: error.message || "E-Mail konnte nicht gesendet werden." };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "E-Mail konnte nicht gesendet werden.";
    return { success: false, error: msg };
  }
}

/**
 * Set new password using token: validate token, hash password, update user, delete token.
 */
export async function updatePassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const rawToken = String(token || "").trim();
  const rawPassword = String(newPassword || "").trim();

  if (!rawToken) {
    return { success: false, error: "Token ist erforderlich." };
  }
  if (rawPassword.length < 6) {
    return { success: false, error: "Passwort muss mindestens 6 Zeichen haben." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token: rawToken },
  });

  if (!record) {
    return { success: false, error: "Ungültiger oder abgelaufener Link. Bitte fordern Sie einen neuen an." };
  }
  if (record.expires < new Date()) {
    await prisma.passwordResetToken.deleteMany({ where: { token: rawToken } });
    return { success: false, error: "Der Link ist abgelaufen. Bitte fordern Sie einen neuen Link an." };
  }

  const hashedPassword = await hash(rawPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.email },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.deleteMany({ where: { token: rawToken } }),
  ]);

  return { success: true };
}
