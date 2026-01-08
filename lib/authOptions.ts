import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";

// OBRISALI SMO ONU LINIJU process.env.NEXTAUTH_URL KOJA JE PRAVILA HAOS NA VERCELU

export const authOptions: NextAuthOptions = {
  // Na Vercelu ovo obično nije nužno, ali neka stoji za svaki slučaj
  // @ts-ignore
  trustHost: true,

  // Ostavljamo šifru hardkodiranu da ne misliš o Environment varijablama
  secret: "tvoja_super_tajna_sifra_za_prezentaciju_123",

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dana
  },
  
  pages: {
    signIn: "/login",
  },
  
  // OBRISALI SMO 'cookies' SEKCIJU - Vercel zna sam podesiti kolačiće bolje od nas
  
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Podaci nedostaju");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          throw new Error("Pogrešan email ili lozinka");
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Pogrešan email ili lozinka");
        }

        if (!user.isActive) {
            throw new Error("Račun deaktiviran");
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
    // OBRISALI SMO 'redirect' CALLBACK - Neka NextAuth radi standardno
  }
};