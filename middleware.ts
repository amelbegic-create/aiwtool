import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Ovdje eksplicitno kažemo: Ako token postoji, pusti ga.
        // Ovo rješava problem sa Secure vs Non-Secure kolačićima
        return !!token;
      },
    },
    pages: {
      signIn: "/login", // Promijenio sam ovo u /login da izbjegnemo loop na početnoj
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/restaurants/:path*",
    "/select-restaurant", // Dodao sam i ovo da bude zaštićeno
    "/tools/:path*",      // Dodao sam tools jer ti tu puca
    "/r/:path*",
  ],
};