/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 1. Strategija
  session: { strategy: "jwt" },
  
  // 2. Stranice
  pages: { signIn: "/login" },

  // 3. Vercel Ključevi
  secret: process.env.NEXTAUTH_SECRET,
  
  // FIX: Ovo mora ostati, ali bez ručnih kolačića!
  // @ts-ignore
  trustHost: true,

  // 4. Provideri
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;
        if (!user.isActive) return null;

        const isBcryptValid = await compare(credentials.password, user.password);
        const isPlainValid = credentials.password === user.password;
        
        if (!isBcryptValid && !isPlainValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          image: user.image,
        } as any;
      },
    }),
  ],

  // 5. Callbacks
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
        token.permissions = user.permissions;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.permissions = token.permissions || [];
        session.user.image = token.picture;
      }
      return session;
    },
    // Važno: Dozvoli redirekciju samo na isti domen
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  },
};