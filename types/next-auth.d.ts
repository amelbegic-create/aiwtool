import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

// Definišemo tip za tvoj JSON objekat permisija
type PermissionSet = Record<string, string[]> | null; 

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      permissions: PermissionSet;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: Role;
    permissions: PermissionSet;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    permissions: PermissionSet;
  }
}