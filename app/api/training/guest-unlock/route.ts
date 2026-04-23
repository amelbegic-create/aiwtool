import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "mcd_training_guest";
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

/** Nur wenn `TRAINING_GUEST_PASSWORD` in .env fehlt und Sie lokal `next dev` starten (nicht Vercel, nicht `next start`). */
const DEV_ONLY_FALLBACK_PASSWORD = "1234";

const buckets = new Map<string, { count: number; reset: number }>();

function resolveExpectedGuestPassword(): string | undefined {
  const fromEnv = process.env.TRAINING_GUEST_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  // Lokales next dev: ohne .env trotzdem testbar; Production/Preview braucht immer TRAINING_GUEST_PASSWORD.
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
    console.warn(
      "[guest-unlock] TRAINING_GUEST_PASSWORD nicht gesetzt – verwende lokalen Dev-Fallback. In .env setzen oder Passwort:",
      DEV_ONLY_FALLBACK_PASSWORD
    );
    return DEV_ONLY_FALLBACK_PASSWORD;
  }
  return undefined;
}

function clientKey(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export async function POST(req: Request) {
  const expected = resolveExpectedGuestPassword();
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Gast-Zugang ist nicht konfiguriert. Production/Preview: TRAINING_GUEST_PASSWORD in Vercel setzen und deployen. Lokal: Variable in .env oder `npm run dev` mit Dev-Fallback (siehe .env.example).",
      },
      { status: 503 }
    );
  }

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

  const devAccepts1234 =
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL &&
    password === DEV_ONLY_FALLBACK_PASSWORD;

  if (password !== expected && !devAccepts1234) {
    return NextResponse.json({ ok: false, error: "Falsches Passwort." }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return NextResponse.json({ ok: true });
}
