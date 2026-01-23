import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { requirePermission } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATHNAME = "bonusi/state.json";

async function getExistingBlobUrl() {
  const res = await list({ prefix: "bonusi/", limit: 100 });
  const hit = res.blobs.find((b) => b.pathname === PATHNAME);
  return hit?.url || null;
}

export async function GET() {
  // Samo admini (ili ko već ima permisiju)
  await requirePermission("bonusi:access");

  const url = await getExistingBlobUrl();
  if (!url) {
    return NextResponse.json({ state: null }, { status: 200 });
  }

  const txt = await fetch(url, { cache: "no-store" }).then((r) => r.text());
  return NextResponse.json({ state: txt || null }, { status: 200 });
}

export async function POST(req: Request) {
  await requirePermission("bonusi:access");

  const body = (await req.json().catch(() => null)) as { state?: string } | null;
  const state = body?.state;

  if (typeof state !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await put(PATHNAME, state, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
