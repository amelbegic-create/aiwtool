import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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
          // OVDJE JE DODANO 'as any' DA SE RIJEŠI BUILD GREŠKA
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