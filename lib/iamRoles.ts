/**
 * IAM role sets – single place to avoid circular imports between access.ts and permissions.ts.
 *
 * - PERMISSION_BYPASS_ROLES: full permission check bypass (only SYSTEM_ARCHITECT).
 * - GLOBAL_SCOPE_ROLES: “see all restaurants” / admin-style scope (SYSTEM_ARCHITECT + ADMIN).
 */
export const PERMISSION_BYPASS_ROLES = new Set<string>(["SYSTEM_ARCHITECT"]);

/** Former GOD_MODE_ROLES; SUPER_ADMIN removed from enum – treated as ADMIN after migration. */
export const GLOBAL_SCOPE_ROLES = new Set<string>(["SYSTEM_ARCHITECT", "ADMIN"]);
