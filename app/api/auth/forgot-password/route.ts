import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

const PASSWORD_RESET_PREFIX = "pwd-reset:";

async function sendResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    return { error: "Email servis nije konfiguriran. Kontaktirajte administratora." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "AIW Services – Reset lozinke",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a3826;">Reset lozinke</h2>
          <p>Primili ste ovaj email jer ste zatražili reset lozinke za AIW Services.</p>
          <p><a href="${resetUrl}" style="display: inline-block; background: #1a3826; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Postavi novu lozinku</a></p>
          <p style="color: #666; font-size: 12px;">Link ističe za 1 sat. Ako niste zatražili reset, ignorirajte ovaj email.</p>
          <p style="color: #666; font-size: 12px;">© AIW Services</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err?.message || "Greška pri slanju emaila." };
  }
  return { success: true };
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email je obavezan." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "Ako email postoji u sistemu, poslaćemo link za reset." }, { status: 200 });
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    const identifier = PASSWORD_RESET_PREFIX + normalizedEmail;

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({ data: { identifier, token, expires } });

    let baseUrl = process.env.NEXTAUTH_URL || "";
    if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
    if (!baseUrl) baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
    const resetUrl = `${baseUrl}/login/reset/${token}`;

    const result = await sendResetEmail(normalizedEmail, resetUrl);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: "Ako email postoji u sistemu, poslaćemo link za reset lozinke." }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Greška na serveru." }, { status: 500 });
  }
}
