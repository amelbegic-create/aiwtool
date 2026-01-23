/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  
  // 👇 FIX: Ignorišemo TS grešku, ali ovo MORA ostati za Vercel
  // @ts-ignore
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,

  // 👇 POJEDNOSTAVLJENA COOKIE LOGIKA (Pusti NextAuth da sam odluči)
  // Ovo često rješava problem kad se imena kolačića ne poklapaju
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

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
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            permissions: true,
            image: true,
            isActive: true,
          },
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
        session.user.name = token.name;
        session.user.image = token.picture;
        session.user.role = token.role;
        session.user.permissions = token.permissions || [];
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Dozvoli redirekciju samo na isti host
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};