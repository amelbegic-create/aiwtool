import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tools",
  "/admin",
  "/profile",
  "/select-restaurant",
  "/restaurants",
  "/restaurant",
  "/rules",
  "/team",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Edge auth: no redirect loops.
 * - No token + protected route -> redirect to /login (with callbackUrl).
 * - No token + already on /login -> next (do nothing).
 * - Has token + on /login -> redirect to /dashboard.
 * - Root / -> redirect to /dashboard if token, else /login.
 * - /api/auth, _next, static assets -> never touched (matcher + early return).
 */
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1. Never run auth logic for NextAuth API and static assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Na HTTPS (Vercel) NextAuth koristi __Secure-next-auth.session-token; eksplicitno da middleware čita isti cookie.
  const isSecure = req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
  });

  // 2. User on /login: if has session -> dashboard; else show login (nikad redirect u krug)
  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 3. User on root /: redirect based on session
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 4. Protected route without token -> redirect to login (no loop: login is excluded above)
  if (isProtected(pathname) && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Samo ove rute – nikad /api/* (NextAuth mora uvijek dobiti JSON, ne HTML iz middlewarea).
 * Negativni lookahead u matcheru nije pouzdan s path-to-regexp u svim Next verzijama.
 */
export const config = {
  matcher: [
    "/",
    "/login",
    "/login/:path*",
    "/dashboard/:path*",
    "/tools/:path*",
    "/admin/:path*",
    "/profile",
    "/profile/:path*",
    "/select-restaurant",
    "/select-restaurant/:path*",
    "/restaurants/:path*",
    "/restaurant/:path*",
    "/rules/:path*",
    "/team",
    "/team/:path*",
  ],
};
