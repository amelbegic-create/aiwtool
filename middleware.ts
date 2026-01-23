import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tools/:path*",
    "/profile/:path*",
    "/admin/:path*",
    // ✅ uklonjeno: "/select-restaurant/:path*"
  ],
};
