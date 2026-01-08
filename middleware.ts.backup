import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/", // Preusmjerava na početnu ako korisnik nije ulogovan
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/restaurants/:path*",
    "/r/:path*",
  ],
};