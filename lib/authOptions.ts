import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  debug: true, // Da vidimo greške u logovima ako ih bude
  
  // 1. HARDKODIRANE TAJNE (Da budemo 100% sigurni)
  secret: "tvoja_super_tajna_sifra_koja_sigurno_radi_123_456", 
  
  // 2. FORSIRANJE KOLAČIĆA (Ovo rješava LOGIN LOOP)
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // Bitno za Railway/Vercel
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dana
  },
  
  pages: {
    signIn: "/login",
  },
  
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Molimo unesite email i lozinku.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          throw new Error("Korisnik ne postoji.");
        }

        const isPasswordValid = await compare(credentials.password, user.password || "");

        if (!isPasswordValid) {
          throw new Error("Pogrešna lozinka.");
        }

        if (!user.isActive) {
            throw new Error("Vaš nalog je deaktiviran.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions as any, 
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    }
  }
};