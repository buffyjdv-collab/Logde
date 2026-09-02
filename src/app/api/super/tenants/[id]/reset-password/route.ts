import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isSuperAdmin,
  getUserId,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";

/**
 * POST /api/super/tenants/[id]/reset-password
 * Body: { password? } (optional — auto-generates if not provided)
 *
 * Resets the owner user's password for a tenant. Returns the new credentials
 * (shown once) so the Super Admin can share them with the tenant owner.
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
    if (id === PLATFORM_TENANT_ID) {
      return error("Tenant not found", 404);
    }

    const tenant = await db.tenant.findUnique({ where: { id } });
    if (!tenant) return error("Tenant not found", 404);

    // Find the owner user for this tenant.
    const owner = await db.user.findFirst({
      where: { tenantId: tenant.id, role: "owner" },
      include: { roleRef: true },
    });
    if (!owner) {
      return error("No owner user found for this tenant", 404);
    }

    const body = await req.json().catch(() => ({}));
    const newPassword =
      body.password && body.password.length >= 6
        ? body.password
        : Math.random().toString(36).slice(2, 10);

    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync(newPassword, 10);

    await db.user.update({
      where: { id: owner.id },
      data: { password: hash, active: true },
    });

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        userId: (await getUserId()) ?? null,
        action: "reset_password",
        entity: "user",
        entityId: owner.id,
        details: `Reset password for ${owner.email} (tenant: ${tenant.name})`,
      },
    });

    return json({
      ownerName: owner.name,
      email: owner.email,
      password: newPassword,
      message: "Password reset successful. Share these credentials with the tenant owner.",
    });
  } catch (e) {
    console.error("[super.tenants.resetPassword]", e);
    return error("Failed to reset password", 500);
  }
}
