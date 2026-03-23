# IAM verification matrix (post-redesign)

Manual smoke checks before rollout. Run after DB migration + `prisma generate` + permission backfill.

## URL / server guards

| Check | Expected |
|--------|-----------|
| Open `/admin` without `admin_panel:access` | `NoPermission` (layout gate) |
| Open `/admin/users` without `users:access` | Submodule guard blocks |
| Open `/admin/restaurants` without `restaurants:access` | Submodule guard blocks |
| Open `/admin/holidays` without `holidays:manage` | Submodule guard blocks |
| Direct POST `/api/admin/users` without `users:manage` | 403 |

## Navigation

| Check | Expected |
|--------|-----------|
| Top nav „Admin“ / Admin Panel link | Only if `admin_panel:access` **or** `SYSTEM_ARCHITECT` (bypass) |
| Admin home cards | Only modules for which the user has the matching permission |

## SYSTEM_ARCHITECT stealth

| Check | Expected |
|--------|-----------|
| User list in `/admin/users` as `ADMIN` | No `SYSTEM_ARCHITECT` rows |
| Supervisor dropdown on user edit as `ADMIN` | No architects |
| Same as `SYSTEM_ARCHITECT` viewer | Sees other architects |
| Team / labor candidate lists | Same stealth rule for viewer role |

## Vacation

| Check | Expected |
|--------|-----------|
| `MANAGER` with `vacation:approve`, same restaurant, not supervisor | Can approve/reject |
| `MANAGER` without shared restaurant | Denied |
| `ADMIN` with `vacation:approve` | Can approve globally (global-scope role) |
| `ADMIN` without `vacation:approve` | Denied unless listed supervisor on request |
| `MANAGEMENT` with only `vacation:approve`, not supervisor | Denied (no restaurant path for that role) |
| Self-approve own pending request | Denied (except bypass architect path) |

## Session / permissions

| Check | Expected |
|--------|-----------|
| Change user `permissions[]` in DB | Next server action respects new rights (JWT may lag for client-only UI until re-login) |
