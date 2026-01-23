/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

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

        console.log("LOGIN USER ROLE:", user.role);

        // VRLO BITNO: vrati email + id (NextAuth koristi email u tokenu)
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
    // JWT se poziva često — ovdje svjesno sinhronizujemo token sa DB
    async jwt({ token, user }: any) {
      // Ako je sign-in: user postoji → osiguraj token fields
      if (user) {
        token.id = user.id;
        token.email = user.email; // KLJUČNO
      }

      // Ako imamo email u tokenu → uvijek refresuj role/permisije iz baze
      if (token?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, role: true, permissions: true, isActive: true, name: true, image: true },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.permissions = dbUser.permissions || [];
          token.isActive = dbUser.isActive;
          token.name = dbUser.name;
          token.picture = dbUser.image; // NextAuth standard field
        }
      }

      return token;
    },

    async session({ session, token }: any) {
      // Ako je user deaktiviran, force logout
      if (token?.isActive === false) {
        return null;
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name ?? session.user.name;
        session.user.image = token.picture ?? session.user.image;

        session.user.role = token.role;
        session.user.permissions = token.permissions || [];

        console.log("SESSION ROLE SET TO:", session.user.role);
      }

      return session;
    },

    // Ne forsiraj uvijek /dashboard (to zna praviti loop)
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      return `${baseUrl}/dashboard`;
    },
  },
};
