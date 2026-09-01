import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isSuperAdmin,
  getUserId,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";
import { formatPlatformFeePayment } from "@/lib/formatters";

/**
 * POST /api/super/platform-fee-payments/[id]/pay
 * Body: { amount, method, reference? }
 * Records a payment against a PlatformFeePayment:
 *  - amountPaid is increased by `amount` (capped at amountDue).
 *  - method/reference are persisted.
 *  - status becomes "paid" + paidAt = now when amountPaid >= amountDue,
 *    otherwise "partial".
 * Audit log entry written.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }
    const { id } = await params;

    const payment = await db.platformFeePayment.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!payment) return error("Platform fee payment not found", 404);
    if (payment.tenantId === PLATFORM_TENANT_ID) {
      return error("Cannot collect fees from the platform tenant", 400);
    }

    const body = await req.json().catch(() => ({}));
    const { amount, method, reference } = body as {
      amount?: number;
      method?: string;
      reference?: string;
    };
    if (typeof amount !== "number" || amount <= 0) {
      return error("amount must be a positive number", 400);
    }
    if (!method) return error("method is required", 400);

    const newAmountPaid = Math.min(
      payment.amountDue,
      payment.amountPaid + amount
    );
    const isPaid = newAmountPaid >= payment.amountDue;
    const newStatus = isPaid ? "paid" : "partial";

    const updated = await db.platformFeePayment.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        method,
        reference: reference ?? payment.reference,
        status: newStatus,
        paidAt: isPaid ? new Date() : payment.paidAt,
      },
      include: { tenant: true },
    });

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        userId: (await getUserId()) ?? null,
        action: "collect_fee",
        entity: "platform_fee_payment",
        entityId: id,
        details: `Collected ₹${amount} via ${method} from "${updated.tenant.name}" for period ${payment.period} (${newStatus})`,
      },
    });

    return json({
      ...formatPlatformFeePayment(updated),
      tenant: {
        id: updated.tenant.id,
        name: updated.tenant.name,
        slug: updated.tenant.slug,
      },
    });
  } catch (e) {
    console.error("[super.platform-fee-payments.pay]", e);
    return error("Failed to record fee payment", 500);
  }
}
