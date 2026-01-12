import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuth = !!token;
  
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  
  // Definišemo koje su rute zaštićene (Dashboard I Admin panel)
  const isProtectedRoute = 
      req.nextUrl.pathname.startsWith("/dashboard") || 
      req.nextUrl.pathname.startsWith("/admin");

  // 1. Ako je korisnik na Login stranici, a VEĆ je ulogovan
  if (isAuthPage) {
    if (isAuth) {
      // Ovdje ga šaljemo na select-restaurant (ako je to tvoja root ruta "/") ili dashboard
      // Ako je tvoja "/" ruta Select Restaurant, onda ga šalji tamo:
      return NextResponse.redirect(new URL("/", req.url)); 
    }
    return null;
  }

  // 2. Ako NIJE ulogovan, a pokušava ući na zaštićene rute (Dashboard ili Admin)
  if (!isAuth && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  
  // 3. (Opcionalno) Ako je na "/" (Select Restaurant), a NIJE ulogovan -> Login
  if (!isAuth && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// KLJUČNO: Ovdje smo dodali "/admin/:path*" da middleware uopšte "vidi" tu rutu
export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/admin/:path*"],
};