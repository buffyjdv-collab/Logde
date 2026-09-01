---
Task ID: 6b
Agent: Frontend Builder — Super Admin Views
Task: Build 5 Super Admin view components (platform dashboard, tenants, platform fees, plans, audit)

## Work Log
- Read `/home/z/my-project/worklog.md` (Tasks 5, 5b, 7, 8, 9) to confirm the API contract (`superDashboardApi`, `tenantsApi`, `platformFeesApi`, `permissionsApi`), the `PlatformDashboard` / `PlatformFeeConfig` / `PlatformFeePayment` / `Tenant` / `AuditLog` types, and the shared UI conventions (`StatCard`, `PageHeader`, `StatusBadge`, `EmptyState`, `LoadingTable`).
- Read `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/constants.ts`, `src/components/shared/{stat-card,page-header,status-badge,empty-state}.tsx`, `src/app/page.tsx`, `src/app/api/super/audit/route.ts` to align with the project conventions before writing code.

### 1. Created `src/components/views/platform-dashboard-view.tsx`
- PageHeader "Platform Overview" with `ShieldCheck` icon, description "Cross-tenant metrics & platform health".
- **9 StatCards** in a rose/violet/emerald mix: Total Tenants (rose), Active Tenants (emerald → `CheckCircle2`), Suspended (rose), Total Users (violet), Total Bookings (emerald), Gross Platform Revenue (emerald), Platform Fees Collected (rose), Platform Fees Pending (amber), MRR (violet).
- **Tenants table** (scrollable `max-h-[60vh] overflow-auto scrollbar-thin`, sticky header) — columns: Tenant (name + slug mono), Plan badge (zinc/emerald/sky/violet via `BADGE_COLOR`), Status badge (TENANT_STATUS_MAP), Users, Bookings, Gross Revenue, Fees Collected (emerald), Fees Pending (rose), Fee Config (FeeType badge + value label `${value}%` / `${formatCurrency(value)}/mo` / `${formatCurrency(value)}/booking` + collection Progress bar), Created date.
- **Recent Platform Fee Payments table** — Tenant name, Period, Gross Revenue, Fee Rate (%), Amount Due, Amount Paid (emerald/pending/overdue color), Status badge (paid=emerald / pending=amber / partial=sky / overdue=rose), Due Date, Paid Date.
- Loading skeleton (9 stat card placeholders + 2 `LoadingTable`s) and empty states for both tables.
- Uses `superDashboardApi.get()` with `queryKey: ["super-dashboard"]`. Defined a local `TenantRow` sub-component for the per-tenant table cell rendering and `FeePaymentRow` for the payment row.
- Status/badge/plan/fee-type maps built inline (using `BADGE_COLOR` from constants so Tailwind picks up the static class names).

### 2. Created `src/components/views/tenants-view.tsx`
- PageHeader "Tenants" with `Building2` icon and "Create Tenant" button.
- **Stats row** (4 cards): Total Tenants (rose), Active (emerald → `CheckCircle2`), Suspended (rose), New This Month (violet → `Sparkles`).
- Filters: search input (by name/slug) + status Select (All/Active/Suspended/Cancelled).
- **Tenants table**: Tenant (name + slug), Contact (email + phone), Plan badge, Status badge, Created date, Actions dropdown.
- **Actions dropdown**: View (opens read-only detail dialog with full contact + plan + currency + timezone info), Edit (opens edit dialog), Suspend (AlertDialog confirmation → `tenantsApi.update(id, {status: "suspended"})`) or Activate (direct mutation).
- **Create Tenant dialog**: name, contactEmail, contactPhone, address, plan Select (4 tiers with prices), and an embedded rose-accented box for "Initial Platform Fee Configuration" containing feeType Select + feeValue Input (with conditional % or ₹ suffix).
- **Edit Tenant dialog**: same fields + a status Select (Active/Suspended/Cancelled).
- Uses `tenantsApi.list()`, `tenantsApi.create()`, `tenantsApi.update()`. Mutations invalidate `["tenants"]` + `["super-dashboard"]`. Toasts on success/error.

### 3. Created `src/components/views/platform-fees-view.tsx`
- PageHeader "Platform Fees" with `Percent` icon, description "Configure fee policy per tenant & collect payments".
- **4 StatCards**: Total Collected (all time — rose), Total Pending (amber), Overdue Count (rose), This Month Collected (emerald). Computed client-side from the payments list.
- **Tabs**: "Fee Configurations" and "Fee Payments".
- **Fee Configurations tab**: scrollable table — Tenant (name + slug), Fee Type badge (percentage=violet / fixed_monthly=sky / per_booking=emerald), Fee Value label, Active toggle (Switch, disabled — only editable via the Edit dialog), Notes (truncated), Last Updated, Edit action button.
- **Fee Payments tab**: status Select filter (All/Pending/Partial/Paid/Overdue) + scrollable table — Tenant, Period, Gross Revenue, Fee Rate, Amount Due, Amount Paid (emerald), Balance (rose), Status badge, Due Date, Paid Date, Record Payment action button (only shown when status !== "paid").
- **Edit Fee Configuration dialog**: feeType Select, feeValue Input (with % or ₹ suffix), Active Switch (with helper text), Notes Textarea.
- **Record Payment dialog**: 3 stat tiles (Amount Due / Amount Paid / Balance), Amount Input (prefilled with balance), Method Select (cash/upi/bank_transfer/card), Reference Input.
- Used the **key-prop remount pattern** (`<EditFeeConfigForm key={config.id} ... />`, `<RecordPaymentForm key={payment.id} ... />`) instead of `useEffect` to initialize form state when a different record is opened — this avoids the React 19 `react-hooks/set-state-in-effect` lint error.
- Mutations invalidate `["platform-fee-configs"]`, `["platform-fee-payments"]`, `["super-dashboard"]`. Toasts differentiate paid vs partial outcomes.

### 4. Created `src/components/views/platform-plans-view.tsx`
- PageHeader "Subscription Plans" with `Crown` icon.
- **4 plan cards** in a `xl:grid-cols-4` responsive grid: Starter ₹999 (zinc), Growth ₹2,499 (emerald), Scale ₹4,999 (sky), Enterprise ₹9,999 (violet). Each card shows: top accent bar (`PLAN_TOP_BAR` static map for the color), plan icon (`Sparkles`/`Rocket`/`Plane`/`Crown`), plan name, tenant count, max-rooms badge, price + interval, two stat tiles (Max Rooms, Max Users), and the features list with checkmarks.
- **Stats row**: Total Tenants (rose), Total MRR (emerald), Plans Available (violet), Most Popular (sky).
- **Tenant Subscriptions table**: Tenant (name + slug), Plan badge (color-mapped via `BADGE_COLOR`), Status badge, Started At (using `tenant.createdAt` as a proxy per the spec), Renewal Cycle (Monthly auto-renew), Monthly Fee.
- NO charts — only cards + table. Uses `tenantsApi.list()` for both plan counts and the table.
- Used a static `PLAN_TOP_BAR` record for the top-border decoration colors so Tailwind v4 picks up the class names statically (avoids the dynamic class issue).

### 5. Created `src/components/views/platform-audit-view.tsx`
- PageHeader "Audit Logs" with `ScrollText` icon, description "Cross-tenant activity trail", and "Export CSV" button in actions.
- **Stats row**: Total Logs (rose), Today (violet), Active Tenants (emerald), Distinct Users (sky).
- **Filters card**: tenant Select (built from `tenantsApi.list()`), entity Select (built dynamically from unique entities in the logs), search Input (matches action / entity / details / user / tenant name).
- **Audit table** (scrollable `max-h-[60vh] overflow-y-auto scrollbar-thin`): Timestamp, Tenant (name + slug), User (name + email, or "System"), Action badge (color-coded by keyword: create=emerald, update=sky, delete=rose, login=violet, etc.), Entity badge (mono, capitalized), Details.
- Fetches from `/api/super/audit` using a direct `useQuery` with `queryKey: ["platform-audit"]` and a fetch-based `queryFn` (per spec — not through the `api()` helper since the AuditLog type didn't originally include `tenantId`/`userId`). Defined a local `PlatformAuditLog` interface that extends `AuditLog` with `tenantId`, `userId`, and the populated `tenant` field.
- **Export CSV button**: builds a CSV string (Timestamp, Tenant, User, Action, Entity, Entity ID, Details), wraps in a Blob, triggers download with `lodgehub-platform-audit-yyyy-MM-dd.csv` filename, fires a sonner toast with the exported count.

### Lint / Type Fixes
- Fixed two initial lint errors:
  - `react-hooks/set-state-in-effect` violations in `EditFeeConfigDialog` and `RecordPaymentDialog` — fixed by extracting the form contents into `EditFeeConfigForm` / `RecordPaymentForm` sub-components and using a `key={record.id}` to remount with fresh `useState` initial values.
  - Removed the now-unused `useEffect` import from `platform-fees-view.tsx`.
- Fixed two runtime errors during dev compile:
  - `Building2Check` is not a valid lucide-react export. Replaced with `CheckCircle2` in both `platform-dashboard-view.tsx` and `tenants-view.tsx`.
  - `PlatformAuditLog` interface initially missed `tenantId` / `userId` (the AuditLog type in `src/lib/types.ts` doesn't include them, but the `/api/super/audit` route returns them) — extended the local interface so `l.tenantId` and `l.userId` type-check.
- Verified all icons used (`ShieldCheck`, `Building2`, `CheckCircle2`, `PauseCircle`, `Users`, `CalendarCheck`, `IndianRupee`, `HandCoins`, `Clock`, `TrendingUp`, `Percent`, `AlertTriangle`, `CalendarClock`, `Pencil`, `Wallet`, `Pause`, `PlayCircle`, `Mail`, `Phone`, `Plus`, `Search`, `Eye`, `ScrollText`, `Download`, `Filter`, `Activity`, `Sparkles`, `Rocket`, `Plane`, `Crown`, `Star`, `Check`) exist in lucide-react via a `node -e` script.

### Verification
- `bun run lint` → exit code 0, zero errors, zero warnings.
- `bunx tsc --noEmit --skipLibCheck` → zero errors in any of the 5 new view files (only pre-existing errors in `examples/`, `skills/`, and `src/app/api/auth/me/route.ts` remain, none of which were touched).
- Smoke-tested all backing API endpoints with `curl -H "x-tenant-id: tenant_platform" -H "x-user-id: user_superadmin"`:
  - `GET /api/super/dashboard` → 3 tenants (2 active + 1 suspended), 7 users, 22 bookings, ₹112,289 gross, ₹15,850 fees collected, ₹8,506 pending, MRR ₹2,499 — matches my UI's expected `PlatformDashboard` shape exactly.
  - `GET /api/super/platform-fee-payments` → 6 payments across Pine Valley + Sunset Beach with `tenant` populated.
  - `GET /api/super/audit` → logs with `tenantId`/`userId` + populated `user`/`tenant`.
- Dev server recompiles cleanly: `✓ Compiled in 379ms` + `GET / 200 in 642ms` after the icon fix.
- NO `recharts` imports anywhere — only tables, StatCards, Badges, and one `Progress` bar in the platform dashboard's tenant row (collection %).

Stage Summary:
- 5 view components shipped under `src/components/views/`: `platform-dashboard-view.tsx`, `tenants-view.tsx`, `platform-fees-view.tsx`, `platform-plans-view.tsx`, `platform-audit-view.tsx`.
- Each view is fully client-side (`"use client"`) using TanStack Query for server state, `sonner` toasts for feedback, shadcn/ui components for the chrome (Card, Badge, Button, Input, Label, Switch, Textarea, Select, Table, Tabs, Dialog, AlertDialog, DropdownMenu).
- Loading + empty states wired in via the shared `<EmptyState>` / `<LoadingTable>` components; all tables wrapped in `max-h-[60vh] overflow-auto scrollbar-thin` containers with sticky headers.
- Mobile-first: stat grids collapse from `lg:grid-cols-4/5` → `md:grid-cols-3` → `grid-cols-2` on mobile; filters stack vertically on small screens; all touch targets ≥ 32px.
- Hospitality emerald theme preserved throughout with super-admin rose accent (rose stat cards + rose hover/active states in the dialogs and confirmations).
- The router in `src/app/page.tsx` already imported these 5 components — this task completes the wiring without modifying `page.tsx`.
