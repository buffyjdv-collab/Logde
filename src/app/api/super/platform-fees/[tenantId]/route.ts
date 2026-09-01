import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isSuperAdmin,
  getUserId,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";
import { formatPlatformFeeConfig } from "@/lib/formatters";

/**
 * PATCH /api/super/platform-fees/[tenantId]
 * Body: { feeType?, feeValue?, active?, notes? }
 * Updates the platform fee config for a single tenant. Writes an audit log.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }
    const { tenantId } = await params;
    if (tenantId === PLATFORM_TENANT_ID) {
      return error("Cannot configure platform fee for the platform tenant", 400);
    }

    const existing = await db.platformFeeConfig.findUnique({
      where: { tenantId },
    });
    if (!existing) return error("Fee config not found", 404);

    const body = await req.json().catch(() => ({}));
    const { feeType, feeValue, active, notes } = body as {
      feeType?: string;
      feeValue?: number;
      active?: boolean;
      notes?: string;
    };

    const data: Record<string, unknown> = {};
    if (feeType !== undefined) {
      if (!["percentage", "fixed_monthly", "per_booking"].includes(feeType)) {
        return error("Invalid feeType", 400);
      }
      data.feeType = feeType;
    }
    if (feeValue !== undefined) {
      if (typeof feeValue !== "number" || feeValue < 0) {
        return error("feeValue must be a non-negative number", 400);
      }
      data.feeValue = feeValue;
    }
    if (active !== undefined) data.active = !!active;
    if (notes !== undefined) data.notes = notes || null;

    const updated = await db.platformFeeConfig.update({
      where: { tenantId },
      data,
      include: { tenant: true },
    });

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        userId: (await getUserId()) ?? null,
        action: "update",
        entity: "platform_fee_config",
        entityId: updated.id,
        details: `Updated platform fee for "${updated.tenant.name}" → ${updated.feeType} ${updated.feeValue}`,
      },
    });

    return json({
      ...formatPlatformFeeConfig(updated),
      tenant: {
        id: updated.tenant.id,
        name: updated.tenant.name,
        slug: updated.tenant.slug,
      },
    });
  } catch (e) {
    console.error("[super.platform-fees.update]", e);
    return error("Failed to update platform fee config", 500);
  }
}
