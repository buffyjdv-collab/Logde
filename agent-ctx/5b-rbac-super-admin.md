# Task 5b — RBAC, Super Admin & Molecular Revenue Report API

## Task
Build the RBAC, Super Admin, and molecular revenue report API routes for LodgeHub.

## Work Log
- Read `worklog.md` (Tasks 5, 7-a, 7-b, 7-c) to understand previous work and conventions.
- Read `prisma/schema.prisma` (Permission / Role / RolePermission / PlatformFeeConfig / PlatformFeePayment models already present), `src/lib/server.ts` (RBAC helpers), `src/lib/permissions.ts` (PERMISSION_CATALOG), `src/lib/types.ts` (Permission / Role / PlatformFeeConfig / PlatformFeePayment / PlatformDashboard / RevenueReport types), `src/lib/formatters.ts`, `src/lib/db.ts`, and existing route handlers (`dashboard`, `reports`, `staff`, `audit`, `rooms/[id]`) to align with project conventions (try/catch + `json()` / `error()` helpers, `params: Promise<{...}>`, `formatX()` for response shaping).
- Added 5 new formatters to `src/lib/formatters.ts`: `formatTenant`, `formatPermission`, `formatRole`, `formatPlatformFeeConfig`, `formatPlatformFeePayment` — all reuse the existing `safeParse` helper to expand `menuItems` JSON. Updated the type-import block at the top of the file accordingly.
- Added `RevenueReport` to the type imports in `src/lib/api.ts` (the client was already calling the `/api/reports/revenue` route but the type was never imported, producing a `Cannot find name 'RevenueReport'` TS error).

### Routes built (13 files)

1. **`src/app/api/permissions/route.ts`** (GET) — Returns the full permission catalog from `PERMISSION_CATALOG`, ordered by `module` then `action`, with each entry enriched with its persisted Permission DB id. No auth required.

2. **`src/app/api/roles/route.ts`** (GET + POST) —
   - GET: super admin sees all roles (system + every tenant's); tenant users see only their own tenant's roles. Each role includes parsed `menuItems`, full `permissions[]`, and `userCount` (via `_count.users`).
   - POST: `authorize("staff.manage_roles")`. Body `{ name, label, description?, permissionKeys: string[], menuItems: string[] }`. Validates uniqueness `(tenantId, name)`, looks up Permission rows by key (rejects unknown keys), creates the role with `menuItems` JSON-stringified, batch-creates RolePermission rows. Writes an audit log.

3. **`src/app/api/roles/[id]/route.ts`** (PATCH + DELETE) —
   - PATCH: `authorize("staff.manage_roles")`. Body `{ label?, description?, permissionKeys?, menuItems? }`. System roles reject `permissionKeys` changes with a 400. When `permissionKeys` provided, deletes existing RolePermission rows and recreates them (validated against the catalog).
   - DELETE: `authorize("staff.manage_roles")`. Refuses to delete system roles (400) or roles still assigned to users (400). Cascade removes RolePermission automatically. Audit log written.

4. **`src/app/api/staff/[id]/role/route.ts`** (PATCH) — `authorize("staff.manage")`. Body `{ roleId }`. Validates the role belongs to the same tenant (or is a system role) and refuses to assign a `isSuperAdmin` role to a tenant user. Mirrors the role name onto the legacy `role` field for backward compat. Audit log written.

5. **`src/app/api/super/dashboard/route.ts`** (GET) — `isSuperAdmin()` gate. Returns the full `PlatformDashboard`: tenant counts (total/active/suspended), `totalUsers`, `totalBookings`, `totalGrossRevenue` (sum of non-refund payments), `totalPlatformFeesCollected` (sum amountPaid), `totalPlatformFeesPending` (sum max(0, amountDue − amountPaid) for non-paid rows), `mrr` (sum of active subscription plan prices), per-tenant summaries (userCount, bookingCount, grossRevenue, feesCollected, feesPending, platformFeeConfig), and `recentFeePayments` (last 10 with tenant included).

6. **`src/app/api/super/tenants/route.ts`** (GET + POST) —
   - GET: all tenants except `tenant_platform`, newest first, with `_count` users/bookings + platformFeeConfig.
   - POST: body `{ name, contactEmail, contactPhone?, address?, plan?, feeType?, feeValue? }`. Creates the tenant (slug = slugified name + random 4-char suffix, re-tried until unique), creates a tenant-scoped default `owner` role with `DEFAULT_ROLE_PERMISSIONS.owner` permissions, creates the tenant's `PlatformFeeConfig` (default `percentage` 5%). Audit log written on `tenant_platform`.

7. **`src/app/api/super/tenants/[id]/route.ts`** (GET + PATCH) —
   - GET: single tenant with platformFeeConfig, subscription (with plan), and counts (users/bookings/rooms).
   - PATCH: body `{ name?, contactEmail?, contactPhone?, address?, plan?, status? }`. Writes a dedicated audit log line for status transitions (e.g. `active → suspended`).

8. **`src/app/api/super/platform-fees/route.ts`** (GET) — Returns all PlatformFeeConfig rows (excluding `tenant_platform`) with the parent tenant included.

9. **`src/app/api/super/platform-fees/[tenantId]/route.ts`** (PATCH) — `isSuperAdmin()` gate. Body `{ feeType?, feeValue?, active?, notes? }`. Validates `feeType` ∈ {percentage, fixed_monthly, per_booking} and `feeValue` is a non-negative number. Refuses to operate on `tenant_platform`. Audit log written.

10. **`src/app/api/super/platform-fee-payments/route.ts`** (GET) — `isSuperAdmin()` gate. Returns all PlatformFeePayments (excluding `tenant_platform`'s) with tenant included, ordered by `dueDate desc`. Supports `?status=` and `?tenantId=` query filters.

11. **`src/app/api/super/platform-fee-payments/[id]/pay/route.ts`** (POST) — `isSuperAdmin()` gate. Body `{ amount, method, reference? }`. Caps `amountPaid` at `amountDue`; sets `paidAt = now` + `status = "paid"` when fully paid, else `status = "partial"`. Refuses to operate on `tenant_platform`. Audit log written (with userId).

12. **`src/app/api/super/audit/route.ts`** (GET) — `isSuperAdmin()` gate. Returns the most recent 100 cross-tenant audit logs (with user + tenant included), newest first. Supports `?tenantId=` filter.

13. **`src/app/api/reports/revenue/route.ts`** (GET) — The molecular/deep revenue report. `authorize("reports.view")` for permission; for super admin (`auth.tenantId === "tenant_platform"`), the acting tenant is resolved from the `x-tenant-id` header so they can inspect any tenant, while tenant users are pinned to their own tenantId (preventing header-spoofing escapes). Query `?range=7d|30d|90d|1y` (default 30d). Returns the full `RevenueReport` shape:
    - `totals`: grossRevenue (sum of non-refund payments in range), platformFee (per tenant's PlatformFeeConfig: `percentage` = gross × feeValue/100, `fixed_monthly` = feeValue × ceil(days/30), `per_booking` = feeValue × bookings-created-in-range), netRevenue, taxes (sum of invoices.taxAmount in range), expenses (sum in range), netProfit (netRevenue − expenses), bookings (count created in range).
    - `daily[]`: per-day aggregates — for `percentage` the platformFee is gross × rate per day; for other fee types it's the total fee attributed proportionally to gross so the daily totals still sum back to the total fee.
    - `byRoomType[]`: grouped by `room.roomType.name` — bookings, grossRevenue (tariff × nights + extraBedPrice if extraBed), platformFee (gross × effective rate), netRevenue.
    - `bySource[]`: grouped by `booking.source` — bookings, grossRevenue, platformFee.
    - `byPaymentMethod[]`: grouped by `payment.method` — amount, count (includes refunds too).
    - `platformFeeSummary`: `{ feeType, feeValue, calculatedFee, paid (sum of PlatformFeePayment.amountPaid in range), pending (max(0, calculatedFee − paid)) }`.
    - `outstandingBookings[]`: active bookings (confirmed/checked_in) where `totalAmount − advancePaid > 0` — bookingCode, guestName, roomNumber, checkIn, checkOut, grossAmount, platformFee (gross × effective rate), netAmount.

### Implementation notes
- All routes use `NextRequest` for handlers that need to parse the URL or receive a body; await `params` for dynamic segments.
- All wrapped in try/catch; `authorize()` failures (Forbidden/Unauthorized) are caught and returned as 403, others as 500 with `[route.name]` log prefix.
- Super-admin routes check `await isSuperAdmin()` first and return `error("Forbidden: super admin only", 403)` if false.
- Audit logs on super-admin actions write under `tenant_platform` and now include the acting user's id via `getUserId()`.
- The tenant's `PlatformFeeConfig` is fetched via `db.platformFeeConfig.findUnique({ where: { tenantId } })` (the schema declares `tenantId @unique`).
- Date filtering uses `where: { createdAt: { gte: start, lte: now } }` with `start` computed by subtracting `days − 1` from today (matches the existing `/api/reports` convention).
- Per-group fee attribution uses an `effectiveRate` derived from the totals: `feeValue / 100` for `percentage`, otherwise `totalPlatformFee / grossRevenue` so group fees sum back to the total.

### Lint / TypeScript status
- `bun run lint` — clean (0 errors, 0 warnings; only the pre-existing `prisma/seed.ts:1` unused-eslint-disable directive warning remains, which is outside this task's scope).
- `bunx tsc --noEmit --skipLibCheck` — clean for every file in this task. The only outstanding TS error is `src/app/api/auth/me/route.ts(16,23)` (`if (as === "owner") userId = undefined;` — assigning `undefined` to `string | null`), which is a pre-existing file not modified by this task.

### Smoke tests run (all green)
- `GET /api/permissions` (super admin) — 37 permissions returned, sorted by module/action.
- `GET /api/roles` (super admin) — 7 roles (super_admin system + both tenants' roles).
- `GET /api/roles` (tenant owner) — 5 tenant-scoped roles only.
- `POST /api/roles` — created a `night_mgr` role with 5 permissions; verified the response includes parsed `menuItems` + `permissions[]`.
- `PATCH /api/roles/[id]` — added/removed permissions (RolePermission rows replaced).
- `PATCH /api/roles/[id]` on a system role → 400 "System roles cannot have their permissions changed".
- `DELETE /api/roles/[id]` → `{ success: true }`.
- `PATCH /api/staff/[id]/role` — assigned Sara Thomas to the `accountant` role; `role` field mirrored to "accountant".
- `GET /api/super/dashboard` — 3 tenants (2 active + 1 suspended), 7 users, 22 bookings, ₹112,289 gross, ₹15,850 fees collected, ₹8,506 pending, MRR ₹2,499, 6 recent fee payments.
- `GET /api/super/tenants` (super admin) — 3 tenants with platformFeeConfig + counts.
- `GET /api/super/tenants/[id]` — Pine Valley with userCount=6, bookingCount=22, roomCount=34, subscription plan Growth ₹2,499.
- `PATCH /api/super/platform-fees/tenant_platform` → 400 (cannot configure platform tenant).
- `PATCH /api/super/platform-fees/[tenantId]` for Sunset Beach → updated feeValue + notes.
- `GET /api/super/platform-fee-payments?status=pending` — filtered to pending only.
- `POST /api/super/platform-fee-payments/[id]/pay` (₹2,500 UPI) → status "partial", amountPaid=2500, paidAt=null.
- `POST /api/super/platform-fee-payments/[id]/pay` (₹5,000 NEFT) → capped at amountDue=5506, status "paid", paidAt=now.
- `GET /api/super/audit` — most recent logs across all tenants with user + tenant included.
- `GET /api/reports/revenue?range=30d` (super admin acting on tenant_pinevalley) — gross=112,289, platformFee=5,614 (5%), net=106,675, expenses=38,511, netProfit=68,164, 22 bookings; byRoomType (4 types), bySource (walk_in/phone/online), byPaymentMethod (upi/cash/card), 14 outstanding bookings.
- Forbidden cases: tenant owner hitting `/api/super/tenants` → 403; anonymous hitting `/api/super/dashboard` → 403.
- Tenant owner (with `reports.view` permission) hitting `/api/reports/revenue` → 200 with correct tenant data.

### Stage Summary
- 13 new route handlers shipped under `src/app/api/{permissions,roles,staff/[id]/role,super/*,reports/revenue}`.
- 5 new formatters added to `src/lib/formatters.ts`.
- 1 missing import fixed in `src/lib/api.ts` (RevenueReport type).
- Prisma client regenerated (`bun run db:generate` + `bun run db:push`) so `db.permission`, `db.role`, `db.rolePermission`, `db.platformFeeConfig`, `db.platformFeePayment` are all defined at runtime.
- Dev server restarted (PID 2453, port 3000) so the regenerated Prisma client is picked up.
- Database re-seeded after smoke testing to restore the demo state.
- Lint clean, TypeScript clean for all 13 new files.
