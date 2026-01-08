import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // @ts-ignore
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_123",
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<any> {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await (prisma as any).user.findUnique({ 
          where: { email: credentials.email },
          include: { restaurants: true }
        });
        
        if (!user || !user.password) return null;
        
        // Poredimo lozinke (ako su običan tekst u bazi, koristi credentials.password === user.password)
        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          allowedRestaurants: user.restaurants.map((r: any) => r.restaurantId),
          permissions: user.permissions || [],
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.permissions = user.permissions;
        token.allowedRestaurants = user.allowedRestaurants;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.permissions = token.permissions;
        session.user.allowedRestaurants = token.allowedRestaurants;
      }
      return session;
    }
  }
};