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
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await prisma.user.findUnique({ 
            where: { email: credentials.email } 
        });
        
        if (!user || !user.password) return null;

        const isBcryptValid = await compare(credentials.password, user.password);
        const isPlainValid = credentials.password === user.password;
        
        if (!isBcryptValid && !isPlainValid) return null;

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role, 
            permissions: user.permissions,
            image: user.image
        };
      }
    })
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
          token.id = user.id;
          token.role = user.role;
          token.permissions = user.permissions;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (session.user) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.permissions = token.permissions;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return `${baseUrl}/dashboard`;
    }
  }
};