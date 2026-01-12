// middleware.ts
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Ovim govorimo sistemu da SVE rute osim logina i slika zahtijevaju prijavu
export const config = { 
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|logo.png).*)"] 
};