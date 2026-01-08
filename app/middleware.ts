import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = { 
  // Štiti sve osim login stranice i javnih fajlova
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|logo.png).*)"] 
};