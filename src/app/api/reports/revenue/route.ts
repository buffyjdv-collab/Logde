import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authorize, getTenantId, json, error } from "@/lib/server";
import type { RevenueReport } from "@/lib/types";

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function safeNumber(n: number | null | undefined): number {
  return typeof n === "number" && isFinite(n) ? n : 0;
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.round(ms / 86400000));
}

/**
 * GET /api/reports/revenue?range=7d|30d|90d|1y
 * The molecular/deep revenue report including platform fee.
 * Requires the `reports.view` permission.
 *
 * Computes:
 *  - totals.grossRevenue       : sum of non-refund payments in range
 *  - totals.platformFee        : per the tenant's PlatformFeeConfig
 *      - percentage    : gross * feeValue / 100
 *      - fixed_monthly : feeValue * months in range
 *      - per_booking   : feeValue * bookings created in range
 *  - totals.netRevenue         : gross - platformFee
 *  - totals.taxes              : sum of invoice.taxAmount in range
 *  - totals.expenses           : sum of expenses in range
 *  - totals.netProfit          : netRevenue - expenses
 *  - totals.bookings           : bookings created in range
 *  - daily[]                   : per-day aggregates
 *  - byRoomType[]              : grouped by room.roomType.name
 *  - bySource[]                : grouped by booking.source
 *  - byPaymentMethod[]         : grouped by payment.method
 *  - platformFeeSummary        : { feeType, feeValue, calculatedFee, paid, pending }
 *  - outstandingBookings[]     : active bookings with outstanding balance
 */
export async function GET(req: NextRequest) {
  try {
    // Enforce the permission first (throws if missing). Super admins pass
    // automatically; for tenant users this also confirms their identity and
    // pins their tenantId so they cannot escape their own tenant by
    // spoofing the x-tenant-id header.
    const auth = await authorize("reports.view");
    // Super admins may inspect any tenant — fall back to the request header.
    const tenantId = auth.tenantId === "tenant_platform"
      ? await getTenantId()
      : auth.tenantId;

    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") as keyof typeof RANGE_DAYS) || "30d";
    const days = RANGE_DAYS[range] ?? 30;

    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const monthsInRange = Math.max(1, Math.ceil(days / 30));

    // Parallel fetch of all underlying data.
    const [
      payments,
      bookings,
      expenses,
      invoices,
      feeConfig,
      outstanding,
      feePayments,
    ] = await Promise.all([
      db.payment.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: now },
        },
        select: {
          id: true,
          amount: true,
          method: true,
          type: true,
          createdAt: true,
          bookingId: true,
        },
      }),
      db.booking.findMany({
        where: { tenantId, createdAt: { gte: start, lte: now } },
        include: {
          room: { include: { roomType: true } },
          guest: { select: { name: true } },
        },
      }),
      db.expense.aggregate({
        where: { tenantId, date: { gte: start, lte: now } },
        _sum: { amount: true },
      }),
      db.invoice.aggregate({
        where: { tenantId, createdAt: { gte: start, lte: now } },
        _sum: { taxAmount: true },
      }),
      db.platformFeeConfig.findUnique({ where: { tenantId } }),
      db.booking.findMany({
        where: {
          tenantId,
          status: { in: ["checked_in", "confirmed"] },
        },
        include: {
          room: { select: { number: true } },
          guest: { select: { name: true } },
        },
      }),
      db.platformFeePayment.findMany({
        where: {
          tenantId,
          // Include any fee payment recorded (paidAt or createdAt) in range.
          OR: [
            { paidAt: { gte: start, lte: now } },
            { createdAt: { gte: start, lte: now } },
          ],
        },
        select: { amountPaid: true },
      }),
    ]);

    // ─── Gross revenue (non-refund payments) ──────────────────────────────
    const revenuePayments = payments.filter((p) => p.type !== "refund");
    const grossRevenue = revenuePayments.reduce(
      (s, p) => s + safeNumber(p.amount),
      0
    );

    // ─── Platform fee calculation (from the tenant's config) ──────────────
    const feeType = feeConfig?.feeType ?? "percentage";
    const feeValue = feeConfig?.feeValue ?? 0;
    const bookingsCreatedInRange = bookings.length;

    let platformFee = 0;
    if (feeConfig?.active) {
      if (feeType === "percentage") {
        platformFee = grossRevenue * (feeValue / 100);
      } else if (feeType === "fixed_monthly") {
        platformFee = feeValue * monthsInRange;
      } else if (feeType === "per_booking") {
        platformFee = feeValue * bookingsCreatedInRange;
      }
    }

    const netRevenue = grossRevenue - platformFee;
    const taxes = safeNumber(invoices._sum.taxAmount);
    const expensesTotal = safeNumber(expenses._sum.amount);
    const netProfit = netRevenue - expensesTotal;

    // ─── Effective rate (for per-group fee attribution) ────────────────────
    // For percentage the rate is feeValue/100; for the other fee types we
    // derive an effective rate from the totals so group fees sum to the total.
    let effectiveRate = 0;
    if (grossRevenue > 0) {
      if (feeType === "percentage") effectiveRate = feeValue / 100;
      else effectiveRate = platformFee / grossRevenue;
    }
    const feeForGross = (gross: number) => gross * effectiveRate;

    // ─── Daily aggregation ────────────────────────────────────────────────
    const dailyMap: Record<
      string,
      { grossRevenue: number; bookings: number }
    > = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dailyMap[d.toISOString().split("T")[0]] = {
        grossRevenue: 0,
        bookings: 0,
      };
    }
    for (const p of revenuePayments) {
      const key = new Date(p.createdAt).toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].grossRevenue += safeNumber(p.amount);
    }
    for (const b of bookings) {
      const key = new Date(b.createdAt).toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].bookings += 1;
    }
    // For fixed_monthly and per_booking we attribute platformFee across days
    // proportionally to gross revenue so the daily totals sum back to total.
    const daily = Object.entries(dailyMap).map(([date, v]) => {
      const dayFee =
        feeType === "percentage"
          ? feeForGross(v.grossRevenue)
          : grossRevenue > 0
          ? platformFee * (v.grossRevenue / grossRevenue)
          : 0;
      return {
        date,
        grossRevenue: Math.round(v.grossRevenue),
        platformFee: Math.round(dayFee),
        netRevenue: Math.round(v.grossRevenue - dayFee),
        bookings: v.bookings,
      };
    });

    // ─── By room type ──────────────────────────────────────────────────────
    const roomTypeMap: Record<
      string,
      { bookings: number; grossRevenue: number }
    > = {};
    for (const b of bookings) {
      const name = b.room?.roomType?.name || "Unknown";
      const nights = nightsBetween(
        new Date(b.checkIn),
        new Date(b.checkOut)
      );
      const extras = b.extraBed
        ? safeNumber(b.room?.roomType?.extraBedPrice)
        : 0;
      const gross = safeNumber(b.tariffPerDay) * nights + extras;
      if (!roomTypeMap[name])
        roomTypeMap[name] = { bookings: 0, grossRevenue: 0 };
      roomTypeMap[name].bookings += 1;
      roomTypeMap[name].grossRevenue += gross;
    }
    const byRoomType = Object.entries(roomTypeMap).map(
      ([roomType, v]) => {
        const fee = feeForGross(v.grossRevenue);
        return {
          roomType,
          bookings: v.bookings,
          grossRevenue: Math.round(v.grossRevenue),
          platformFee: Math.round(fee),
          netRevenue: Math.round(v.grossRevenue - fee),
        };
      }
    );

    // ─── By source ────────────────────────────────────────────────────────
    const sourceMap: Record<
      string,
      { bookings: number; grossRevenue: number }
    > = {};
    for (const b of bookings) {
      const src = b.source || "unknown";
      const nights = nightsBetween(
        new Date(b.checkIn),
        new Date(b.checkOut)
      );
      const extras = b.extraBed
        ? safeNumber(b.room?.roomType?.extraBedPrice)
        : 0;
      const gross = safeNumber(b.tariffPerDay) * nights + extras;
      if (!sourceMap[src])
        sourceMap[src] = { bookings: 0, grossRevenue: 0 };
      sourceMap[src].bookings += 1;
      sourceMap[src].grossRevenue += gross;
    }
    const bySource = Object.entries(sourceMap).map(([source, v]) => {
      const fee = feeForGross(v.grossRevenue);
      return {
        source,
        bookings: v.bookings,
        grossRevenue: Math.round(v.grossRevenue),
        platformFee: Math.round(fee),
      };
    });

    // ─── By payment method ─────────────────────────────────────────────────
    const methodMap: Record<
      string,
      { amount: number; count: number }
    > = {};
    for (const p of payments) {
      const m = p.method || "unknown";
      if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 };
      methodMap[m].amount += safeNumber(p.amount);
      methodMap[m].count += 1;
    }
    const byPaymentMethod = Object.entries(methodMap).map(
      ([method, v]) => ({
        method,
        amount: Math.round(v.amount),
        count: v.count,
      })
    );

    // ─── Platform fee summary ──────────────────────────────────────────────
    const paidInRange = feePayments.reduce(
      (s, p) => s + safeNumber(p.amountPaid),
      0
    );
    const platformFeeSummary = {
      feeType,
      feeValue,
      calculatedFee: Math.round(platformFee),
      paid: Math.round(paidInRange),
      pending: Math.round(Math.max(0, platformFee - paidInRange)),
    };

    // ─── Outstanding bookings ─────────────────────────────────────────────
    const outstandingBookings = outstanding
      .map((b) => {
        const gross = safeNumber(b.totalAmount);
        const balance = gross - safeNumber(b.advancePaid);
        if (balance <= 0) return null;
        const fee = feeForGross(gross);
        return {
          bookingCode: b.bookingCode,
          guestName: b.guest?.name || "",
          roomNumber: b.room?.number || "",
          checkIn: new Date(b.checkIn).toISOString(),
          checkOut: new Date(b.checkOut).toISOString(),
          grossAmount: Math.round(gross),
          platformFee: Math.round(fee),
          netAmount: Math.round(gross - fee),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const report: RevenueReport = {
      range,
      totals: {
        grossRevenue: Math.round(grossRevenue),
        platformFee: Math.round(platformFee),
        netRevenue: Math.round(netRevenue),
        taxes: Math.round(taxes),
        expenses: Math.round(expensesTotal),
        netProfit: Math.round(netProfit),
        bookings: bookingsCreatedInRange,
      },
      daily,
      byRoomType,
      bySource,
      byPaymentMethod,
      platformFeeSummary,
      outstandingBookings,
    };

    return json(report);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to generate revenue report";
    if (msg.startsWith("Forbidden:") || msg.startsWith("Unauthorized")) {
      return error(msg, 403);
    }
    console.error("[reports.revenue]", e);
    return error("Failed to generate revenue report", 500);
  }
}
