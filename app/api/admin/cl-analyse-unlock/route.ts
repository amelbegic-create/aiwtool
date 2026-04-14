import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const dynamic = "force-dynamic";

const COOKIE = "mcd_cl_analyse";
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const buckets = new Map<string, { count: number; reset: number }>();

function resolvePassword(): string {
  const fromEnv = process.env.CL_ANALYSE_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return "zoran123";
}

function clientKey(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export async function POST(req: Request) {
  // Must be logged in (admin_panel:access is enforced by admin layout)
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  // Rate limiting
  const key = clientKey(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + WINDOW_MS };
    buckets.set(key, b);
  }
  if (b.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "Zu viele Versuche. Bitte später erneut." }, { status: 429 });
  }
  b.count += 1;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const raw =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";
  const password = raw.trim();

  if (!password || password !== resolvePassword()) {
    return NextResponse.json({ ok: false, error: "Falsches Passwort." }, { status: 401 });
  }

  // No persistent cookie — password is validated per visit (React state manages lock).
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
}
