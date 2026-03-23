import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";

/**
 * SYSTEM_ARCHITECT je „stealth“: ostali korisnici ga ne smiju vidjeti u direktorijima,
 * timovima, padajućim izborima nadređenog itd.
 *
 * SYSTEM_ARCHITECT vidi sve uloge (uključujući druge arhitekte).
 */
export function stealthArchitectWhere(viewerRole: string | Role | null | undefined): Prisma.UserWhereInput {
  if (String(viewerRole) === Role.SYSTEM_ARCHITECT) {
    return {};
  }
  return { role: { not: Role.SYSTEM_ARCHITECT } };
}
