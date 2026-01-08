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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({ 
          where: { email: credentials.email },
          include: { restaurants: true }
        });
        
        if (!user || !user.password) return null;
        
        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        // Vraćamo objekat koji NextAuth očekuje
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          allowedRestaurants: user.restaurants.map(r => r.restaurantId),
          permissions: user.permissions || [],
        } as any; 
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.permissions = (user as any).permissions;
        token.allowedRestaurants = (user as any).allowedRestaurants;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).permissions = token.permissions;
        (session.user as any).allowedRestaurants = token.allowedRestaurants;
      }
      return session;
    }
  }
};