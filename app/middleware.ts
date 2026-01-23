import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Vraća true ako token postoji (korisnik je ulogovan)
        return !!token;
      },
    },
    pages: {
      signIn: "/login", // Gura na login ako nema tokena
    },
  }
);

export const config = {
  // Ovdje navedi SVE rute koje moraju biti zaštićene (gdje moraš biti ulogovan)
  matcher: [
    "/dashboard/:path*",
    "/tools/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/select-restaurant/:path*", // Dodao sam i ovo jer ti je tu pucalo
  ],
};