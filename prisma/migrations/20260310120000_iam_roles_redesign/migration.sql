-- IAM: Replace Role enum; map legacy values. Requires PostgreSQL.

ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM (
  'SYSTEM_ARCHITECT',
  'ADMIN',
  'MANAGER',
  'MANAGEMENT',
  'MITARBEITER'
);

-- User.role
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'SYSTEM_ARCHITECT' THEN 'SYSTEM_ARCHITECT'::"Role"
      WHEN 'SUPER_ADMIN' THEN 'ADMIN'::"Role"
      WHEN 'ADMIN' THEN 'ADMIN'::"Role"
      WHEN 'MANAGER' THEN 'MANAGER'::"Role"
      WHEN 'AREA_MANAGER' THEN 'MANAGER'::"Role"
      WHEN 'SHIFT_LEADER' THEN 'MANAGEMENT'::"Role"
      WHEN 'CREW' THEN 'MITARBEITER'::"Role"
      ELSE 'MITARBEITER'::"Role"
    END
  ),
  ALTER COLUMN "role" SET DEFAULT 'MITARBEITER'::"Role";

-- RolePermissionPreset.role (unique): merge duplicates after mapping
ALTER TABLE "RolePermissionPreset"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'SYSTEM_ARCHITECT' THEN 'SYSTEM_ARCHITECT'::"Role"
      WHEN 'SUPER_ADMIN' THEN 'ADMIN'::"Role"
      WHEN 'ADMIN' THEN 'ADMIN'::"Role"
      WHEN 'MANAGER' THEN 'MANAGER'::"Role"
      WHEN 'AREA_MANAGER' THEN 'MANAGER'::"Role"
      WHEN 'SHIFT_LEADER' THEN 'MANAGEMENT'::"Role"
      WHEN 'CREW' THEN 'MITARBEITER'::"Role"
      ELSE 'MITARBEITER'::"Role"
    END
  );

-- Keep one row per role (merge permission keys from duplicates)
DELETE FROM "RolePermissionPreset" a
  USING "RolePermissionPreset" b
 WHERE a."role" = b."role"
   AND a."id" > b."id";

DROP TYPE "Role_old";
