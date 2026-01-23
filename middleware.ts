import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pusti NextAuth rute i static fajlove
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // ✅ OVO je ključ: Edge provjera JWT-a iz cookie-ja
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET, // mora biti setovan na Vercelu
  });

  // Ako nema tokena → login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/tools/:path*", "/profile/:path*", "/admin/:path*"],
};
