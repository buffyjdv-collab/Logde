import { db } from "@/lib/db";
import { isSuperAdmin, json, error, PLATFORM_TENANT_ID } from "@/lib/server";
import {
  formatTenant,
  formatPlatformFeePayment,
  formatPlatformFeeConfig,
} from "@/lib/formatters";
import type { PlatformDashboard } from "@/lib/types";

/**
 * GET /api/super/dashboard
 * Returns the super-admin platform dashboard: tenant counts, cross-tenant
 * revenue/fee aggregates, MRR, per-tenant summaries, and recent fee payments.
 * Requires the acting user to be a super admin (403 otherwise).
 */
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }

    // Fetch all tenants except the platform tenant.
    const tenants = await db.tenant.findMany({
      where: { id: { not: PLATFORM_TENANT_ID } },
      include: {
        platformFeeConfig: true,
        subscription: { include: { plan: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const tenantIds = tenants.map((t) => t.id);

    // Cross-tenant aggregates (parallel).
    const [
      activeCount,
      suspendedCount,
      totalUsers,
      totalBookings,
      grossRevenueAgg,
      feesPaidAgg,
      feesPendingAgg,
      recentFeePayments,
      activeSubs,
    ] = await Promise.all([
      db.tenant.count({
        where: { id: { not: PLATFORM_TENANT_ID }, status: "active" },
      }),
      db.tenant.count({
        where: { id: { not: PLATFORM_TENANT_ID }, status: "suspended" },
      }),
      db.user.count({ where: { tenantId: { not: PLATFORM_TENANT_ID } } }),
      db.booking.count({ where: { tenantId: { in: tenantIds } } }),
      db.payment.aggregate({
        where: {
          tenantId: { in: tenantIds },
          type: { not: "refund" },
        },
        _sum: { amount: true },
      }),
      db.platformFeePayment.aggregate({
        where: { tenantId: { in: tenantIds } },
        _sum: { amountPaid: true },
      }),
      // pending = amountDue - amountPaid, only for non-paid rows
      db.platformFeePayment.findMany({
        where: {
          tenantId: { in: tenantIds },
          status: { not: "paid" },
        },
        select: { amountDue: true, amountPaid: true },
      }),
      db.platformFeePayment.findMany({
        where: { tenantId: { in: tenantIds } },
        include: { tenant: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.tenantSubscription.findMany({
        where: { status: "active", tenantId: { in: tenantIds } },
        include: { plan: true },
      }),
    ]);

    // Per-tenant rollups (parallel).
    const tenantSummaries = await Promise.all(
      tenants.map(async (t) => {
        const [userCount, bookingCount, grossAgg, feePaidAgg, feePendingRows] =
          await Promise.all([
            db.user.count({ where: { tenantId: t.id } }),
            db.booking.count({ where: { tenantId: t.id } }),
            db.payment.aggregate({
              where: { tenantId: t.id, type: { not: "refund" } },
              _sum: { amount: true },
            }),
            db.platformFeePayment.aggregate({
              where: { tenantId: t.id },
              _sum: { amountPaid: true },
            }),
            db.platformFeePayment.findMany({
              where: { tenantId: t.id, status: { not: "paid" } },
              select: { amountDue: true, amountPaid: true },
            }),
          ]);

        const grossRevenue = grossAgg._sum.amount ?? 0;
        const feesCollected = feePaidAgg._sum.amountPaid ?? 0;
        const feesPending = feePendingRows.reduce(
          (s, r) => s + Math.max(0, r.amountDue - r.amountPaid),
          0
        );

        return {
          ...formatTenant(t),
          userCount,
          bookingCount,
          grossRevenue: Math.round(grossRevenue),
          feesCollected: Math.round(feesCollected),
          feesPending: Math.round(feesPending),
          platformFeeConfig: t.platformFeeConfig
            ? formatPlatformFeeConfig(t.platformFeeConfig)
            : null,
        };
      })
    );

    const totalFeesPending = feesPendingAgg.reduce(
      (s, r) => s + Math.max(0, r.amountDue - r.amountPaid),
      0
    );
    const mrr = activeSubs.reduce((s, sub) => s + (sub.plan?.price ?? 0), 0);

    const dashboard: PlatformDashboard = {
      totalTenants: tenants.length,
      activeTenants: activeCount,
      suspendedTenants: suspendedCount,
      totalUsers,
      totalBookings,
      totalGrossRevenue: Math.round(grossRevenueAgg._sum.amount ?? 0),
      totalPlatformFeesCollected: Math.round(feesPaidAgg._sum.amountPaid ?? 0),
      totalPlatformFeesPending: Math.round(totalFeesPending),
      mrr: Math.round(mrr),
      tenants: tenantSummaries,
      recentFeePayments: recentFeePayments.map((p) => ({
        ...formatPlatformFeePayment(p),
        tenant: formatTenant(p.tenant),
      })),
    };

    return json(dashboard);
  } catch (e) {
    console.error("[super.dashboard]", e);
    return error("Failed to load super admin dashboard", 500);
  }
}
