import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

// --- OVO JE KLJUČNO RJEŠENJE ---
// Ručno postavljamo URL aplikacije prije nego se NextAuth pokrene.
// Server sada mora misliti da je na ovoj adresi.
process.env.NEXTAUTH_URL = "https://aiwtool-production2025.up.railway.app"; 

export const authOptions: NextAuthOptions = {
  // @ts-ignore
  trustHost: true, // Vjeruj proxy-ju

  // Hardkodirana šifra
  secret: "tvoja_super_tajna_sifra_koja_sigurno_radi_123_456", 
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dana
  },
  
  // Eksplicitno podešavanje kolačića za Railway
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true
      }
    }
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
    },
    // Dodajemo redirect callback da budemo sigurni da ne bježi na localhost
    async redirect({ url, baseUrl }) {
      // Ako url počinje sa / (npr /dashboard), dodaj mu naš pravi domen
      if (url.startsWith("/")) return `${process.env.NEXTAUTH_URL}${url}`;
      // Ako je url već validan, vrati ga
      else if (new URL(url).origin === process.env.NEXTAUTH_URL) return url;
      return process.env.NEXTAUTH_URL as string;
    }
  }
};