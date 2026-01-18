import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    
    const isLoginPage = req.nextUrl.pathname.startsWith("/login");
    const isSelectRestPage = req.nextUrl.pathname.startsWith("/select-restaurant");

    // 1. Ako je korisnik već logiran, a ide na Login -> Šalji na Dashboard
    if (isLoginPage && isAuth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // 2. Ako ide na staru stranicu za odabir restorana -> Šalji na Dashboard
    // (Jer sada imamo selektor u headeru)
    if (isSelectRestPage) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = { 
  // Zaštićujemo sve rute osim api-ja, logina i statičkih fajlova
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|logo.png).*)"] 
};