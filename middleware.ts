import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Zaštiti samo dashboard, alate i profil. 
  // NE štiti root (/) ili api rute ovdje da se izbjegne loop.
  matcher: [
    "/dashboard/:path*",
    "/tools/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/select-restaurant/:path*"
  ],
};