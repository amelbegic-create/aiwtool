import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE = "mcd_training_guest";

export async function POST() {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
