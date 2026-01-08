import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  // OVO JE KLJUČNO! Middleware mora imati svoju kopiju šifre:
  secret: "tvoja_super_tajna_sifra_koja_sigurno_radi_123_456", 
  
  callbacks: {
    authorized: ({ token }) => {
      // Ako postoji token, pusti korisnika
      return !!token; 
    },
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/restaurants/:path*",
    "/tools/:path*", 
    "/r/:path*",
  ],
};