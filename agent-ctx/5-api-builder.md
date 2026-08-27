# Task ID 5 — API Builder

LodgeHub backend API routes. Built all 22 route handlers covering every
entity/operation required by the front-end api client (`src/lib/api.ts`).

## Files created
- `src/lib/booking-helpers.ts` — shared `BOOKING_INCLUDE`, `withCreatedBy`
  (maps Prisma's `user` relation → `createdBy` for `formatBooking`), and
  re-exports `formatBooking`.
- `src/app/api/dashboard/route.ts` — GET dashboard stats
- `src/app/api/rooms/route.ts` — GET rooms
- `src/app/api/rooms/[id]/route.ts` — PATCH room (creates housekeeping +
  notification when transitioning to cleaning/maintenance)
- `src/app/api/bookings/route.ts` — GET list, POST create (booking code
  `BK-XXXX`, sets room → reserved, creates payment if advance > 0,
  audit log, notification)
- `src/app/api/bookings/[id]/route.ts` — GET single, PATCH update
  (auto-recomputes `totalAmount` when tariff/dates change)
- `src/app/api/bookings/[id]/checkin/route.ts` — POST check-in (status
  `checked_in`, room `occupied`, audit log)
- `src/app/api/bookings/[id]/checkout/route.ts` — POST check-out (status
  `checked_out`, room `cleaning`, creates housekeeping task, generates
  invoice `INV-XXXX` with line items + tax, marks `paid` if balance = 0,
  audit + notification)
- `src/app/api/bookings/[id]/cancel/route.ts` — POST cancel (status
  `cancelled`, frees room — `cleaning` if was occupied else `available`,
  audit + notification)
- `src/app/api/guests/route.ts` — GET list with search + aggregates
  (`bookingsCount`, `totalSpent`, `lastStay`); POST create
- `src/app/api/guests/[id]/route.ts` — GET single (with bookings +
  payments); PATCH update
- `src/app/api/payments/route.ts` — GET list (date filter); POST create
  (auto-bumps `booking.advancePaid` when `type=advance`, audit log)
- `src/app/api/invoices/[id]/route.ts` — GET single (includes guest via
  `booking.guest`)
- `src/app/api/expenses/route.ts` — GET list (filter by from/to/category);
  POST create
- `src/app/api/expenses/[id]/route.ts` — DELETE expense
- `src/app/api/housekeeping/route.ts` — GET list (filter by status)
- `src/app/api/housekeeping/[id]/route.ts` — PATCH update (when `done`
  sets `completedAt` and room `available`; when `in_progress` keeps room
  `cleaning`; audit log)
- `src/app/api/staff/route.ts` — GET list (excludes password via
  `formatUser`); POST create (placeholder hashed password)
- `src/app/api/staff/[id]/route.ts` — PATCH update (name/role/phone/
  active/propertyId)
- `src/app/api/reports/route.ts` — GET report (range 7d/30d/90d/1y);
  builds `dailyRevenue`, `monthlyRevenue`, `occupancyTrend` (overlap
  approximation), `paymentMethodBreakdown`, `topRooms`,
  `expenseBreakdown`, `outstandingPayments`, `totals`
- `src/app/api/notifications/route.ts` — GET list; PATCH mark-all-read
- `src/app/api/notifications/[id]/route.ts` — PATCH mark-one-read
- `src/app/api/audit/route.ts` — GET last 50 audit logs (with user)

## Schema change
Added the missing `Payment.guest` relation to `prisma/schema.prisma`
(the `guestId` field existed but the Prisma relation didn't, so
`include: { guest: true }` failed). Also added the matching
`Guest.payments Payment[]` back-reference. Ran `bun run db:generate`
and `bun run db:push` to sync.

## Verification
- All 22 route handlers tested via curl with `x-tenant-id:
  tenant_pinevalley` header — every endpoint returns 200 (or 201 for
  POSTs).
- `bun run lint` passes — only the pre-existing `prisma/seed.ts` line-1
  warning (not from this task).

## Note for downstream agents
- The Prisma `Booking.user` relation (FK = `createdBy`) is mapped to
  `createdBy` by the `withCreatedBy` helper before being passed to
  `formatBooking`. Always import from `@/lib/booking-helpers` when
  working with bookings.
- The dev server was restarted from a corrupted turbopack cache
  (caused by removing `.next` while it ran). It is now running
  detached via `setsid nohup ... </dev/null` as PID 3616, parented to
  PID 1. If it dies, restart with:
  `cd /home/z/my-project && (nohup setsid bun run dev > /tmp/dev-start.log 2>&1 < /dev/null &)`
