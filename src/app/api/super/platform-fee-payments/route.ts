import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isSuperAdmin, json, error, PLATFORM_TENANT_ID } from "@/lib/server";
import { formatPlatformFeePayment } from "@/lib/formatters";

/**
 * GET /api/super/platform-fee-payments
 * Query params:
 *   ?status=pending|partial|paid|overdue   (optional filter)
 *   ?tenantId=<id>                         (optional filter)
 * Returns all PlatformFeePayments with their tenant included, ordered by
 * dueDate desc.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const tenantId = searchParams.get("tenantId") || undefined;

    const where: {
      tenantId?: object | string;
      status?: string;
    } = {};
    if (status) where.status = status;
    if (tenantId) {
      where.tenantId = tenantId === PLATFORM_TENANT_ID ? "" : tenantId;
    } else {
      where.tenantId = { not: PLATFORM_TENANT_ID };
    }

    const payments = await db.platformFeePayment.findMany({
      where,
      include: { tenant: true },
      orderBy: { dueDate: "desc" },
    });

    return json(
      payments.map((p) => ({
        ...formatPlatformFeePayment(p),
        tenant: {
          id: p.tenant.id,
          name: p.tenant.name,
          slug: p.tenant.slug,
          plan: p.tenant.plan,
          status: p.tenant.status,
        },
      }))
    );
  } catch (e) {
    console.error("[super.platform-fee-payments.list]", e);
    return error("Failed to load platform fee payments", 500);
  }
}
