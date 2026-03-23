import { Role } from "@prisma/client";
import { PERMISSION_BYPASS_ROLES } from "@/lib/iamRoles";
import { isGlobalScopeRole } from "@/lib/permissions";
import { PermissionDeniedError } from "@/lib/access";

export type VacationApproverContext = {
  id: string;
  role: string;
  restaurants: { restaurantId: string }[];
};

export type VacationRequestApproverTarget = {
  supervisorId: string | null;
  restaurantId: string | null;
  employeeUserId: string;
};

const DENY_DELETE = "Sie sind nicht berechtigt, diesen Antrag zu löschen.";

/**
 * Jedinstveno pravilo za vacation approve / odbijanje / brisanje odobrenog zahtjeva.
 * Redoslijed: bypass → self (samo status) → Vorgesetzte/r → global-scope + vacation:approve → explicit vacation:approve + restoran.
 */
export function assertVacationApproverScope(
  opts: {
    acting: VacationApproverContext;
    request: VacationRequestApproverTarget;
    hasVacationApprovePermission: boolean;
  },
  kind: "status" | "delete" = "status"
): void {
  const { acting, request, hasVacationApprovePermission } = opts;
  const actingRestaurantIds = new Set((acting.restaurants ?? []).map((r) => r.restaurantId));
  const inRestaurant =
    !!request.restaurantId && actingRestaurantIds.has(request.restaurantId);
  const isSupervisor =
    request.supervisorId != null && request.supervisorId === acting.id;

  if (PERMISSION_BYPASS_ROLES.has(String(acting.role))) {
    return;
  }

  if (kind === "status" && request.employeeUserId === acting.id) {
    throw new Error(
      "Sie können Ihren eigenen Urlaubsantrag nicht selbst genehmigen oder ablehnen. Nur Ihr/e Vorgesetzte/r oder die Administration entscheidet."
    );
  }

  if (isSupervisor) {
    // Eksplicitno dodijeljen supervisor uvijek može odobriti, bez obzira na restoran.
    // Provjera restorana važi samo za vacation:approve bez direktne supervizije.
    return;
  }

  if (isGlobalScopeRole(acting.role)) {
    if (!hasVacationApprovePermission) {
      throw new PermissionDeniedError();
    }
    return;
  }

  if (!hasVacationApprovePermission) {
    throw new PermissionDeniedError();
  }

  if (acting.role === Role.MANAGER || acting.role === Role.ADMIN) {
    if (!inRestaurant) {
      throw new Error("Zugriff verweigert: Der Antrag stammt von einem anderen Restaurant.");
    }
    return;
  }

  throw new Error(
    kind === "delete"
      ? DENY_DELETE
      : "Sie sind nicht berechtigt, diesen Antrag zu genehmigen. Bitte wenden Sie sich an den Administrator."
  );
}
