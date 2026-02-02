import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Edge auth protection for private routes.
 *
 * IMPORTANT:
 * - Middleware MUST live in the project root to be applied by Next.js.
 * - We keep the logic minimal and reliable: allow request only when a token exists.
 */
export default withAuth(
  function middleware() {
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
  matcher: [
    "/dashboard/:path*",
    "/tools/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/select-restaurant/:path*",
    "/restaurants/:path*",
    "/restaurant/:path*",
    "/rules/:path*",
  ],
};
