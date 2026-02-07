/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import type { Role } from "@prisma/client";

// URL za NextAuth. NE postavljati NEXTAUTH_URL iz VERCEL_URL kada korisnici dolaze s custom domene (npr. www.aiw.services),
// inače cookie se postavlja za *.vercel.app i sljedeći zahtjev na www.aiw.services nema cookie → login loop.
if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

/**
 * SINGLE SOURCE OF TRUTH for NextAuth config.
 *
 * - Uses JWT session strategy.
 * - Credentials provider with safe password verification.
 * - Auto-upgrades legacy plaintext passwords to bcrypt hash on successful login.
 * - Normalizes session/JWT shape to match `types/next-auth.d.ts`.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,

  // Vercel + custom domena: trustHost = true. NextAuth onda koristi request host (x-forwarded-host) za origin,
  // pa cookie i redirect budu za domenu s koje korisnik dolazi (npr. www.aiw.services). Nemojte postaviti
  // NEXTAUTH_URL na *.vercel.app ako korisnici ulaze preko custom domene.
  // @ts-expect-error - NextAuth v4 typing doesn't always include this flag
  trustHost: true,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        // LOGIN: uvijek prisma direktno, BEZ filtera po roli (Stealth Mode ne smije blokirati System Architect)
        const user = await prisma.user.findUnique({
          where: { email },
          include: { department: { select: { name: true } } },
        });
        if (!user || !user.password) return null;
        if (!user.isActive) return null;

        // 1) Try bcrypt compare (normal case)
        const isBcryptValid = await compare(password, user.password).catch(() => false);

        // 2) Legacy fallback: plaintext password match (migration)
        const isPlainValid = password === user.password;
        if (!isBcryptValid && !isPlainValid) return null;

        // Upgrade plaintext passwords to bcrypt hash on successful login
        if (!isBcryptValid && isPlainValid) {
          const upgradedHash = await hash(password, 12);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: upgradedHash },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role as Role,
          permissions: user.permissions ?? [],
          image: user.image ?? undefined,
          department: user.department?.name ?? undefined,
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
        token.permissions = Array.isArray(user.permissions) ? user.permissions : [];
        token.picture = user.image;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.permissions = Array.isArray(token.permissions) ? token.permissions : [];
        session.user.image = token.picture;
        session.user.department = token.department;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allow only same-origin redirects
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}