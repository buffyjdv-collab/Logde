import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isSuperAdmin,
  getUserId,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";
import { formatTenant, formatPlatformFeeConfig } from "@/lib/formatters";

/**
 * GET /api/super/tenants/[id]
 * Returns a single tenant with its platformFeeConfig, subscription, and counts.
 */
export async function GET(
  _req: NextRequest,
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

    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        platformFeeConfig: true,
        subscription: { include: { plan: true } },
        _count: { select: { users: true, bookings: true, rooms: true } },
      },
    });
    if (!tenant) return error("Tenant not found", 404);

    return json({
      ...formatTenant(tenant),
      userCount: tenant._count?.users ?? 0,
      bookingCount: tenant._count?.bookings ?? 0,
      roomCount: tenant._count?.rooms ?? 0,
      platformFeeConfig: tenant.platformFeeConfig
        ? formatPlatformFeeConfig(tenant.platformFeeConfig)
        : null,
      subscription: tenant.subscription
        ? {
            id: tenant.subscription.id,
            status: tenant.subscription.status,
            startedAt: tenant.subscription.startedAt,
            endsAt: tenant.subscription.endsAt,
            plan: tenant.subscription.plan,
          }
        : null,
    });
  } catch (e) {
    console.error("[super.tenants.get]", e);
    return error("Failed to load tenant", 500);
  }
}

/**
 * PATCH /api/super/tenants/[id]
 * Body: { name?, contactEmail?, contactPhone?, address?, plan?, status? }
 * Updates tenant details. Logs status transitions (suspended/active).
 */
export async function PATCH(
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

    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) return error("Tenant not found", 404);

    const body = await req.json().catch(() => ({}));
    const {
      name,
      contactEmail,
      contactPhone,
      address,
      plan,
      status,
    } = body as {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      plan?: string;
      status?: string;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (contactPhone !== undefined) data.contactPhone = contactPhone || null;
    if (address !== undefined) data.address = address || null;
    if (plan !== undefined) data.plan = plan;
    if (status !== undefined) data.status = status;

    const updated = await db.tenant.update({
      where: { id },
      data,
      include: {
        platformFeeConfig: true,
        subscription: { include: { plan: true } },
      },
    });

    // Log status transitions explicitly.
    if (status && status !== existing.status) {
      await db.auditLog.create({
        data: {
          tenantId: PLATFORM_TENANT_ID,
          userId: (await getUserId()) ?? null,
          action: "update",
          entity: "tenant",
          entityId: id,
          details: `Tenant "${updated.name}" status changed: ${existing.status} → ${status}`,
        },
      });
    } else {
      await db.auditLog.create({
        data: {
          tenantId: PLATFORM_TENANT_ID,
          userId: (await getUserId()) ?? null,
          action: "update",
          entity: "tenant",
          entityId: id,
          details: `Updated tenant "${updated.name}" profile`,
        },
      });
    }

    return json({
      ...formatTenant(updated),
      platformFeeConfig: updated.platformFeeConfig
        ? formatPlatformFeeConfig(updated.platformFeeConfig)
        : null,
      subscription: updated.subscription
        ? {
            id: updated.subscription.id,
            status: updated.subscription.status,
            startedAt: updated.subscription.startedAt,
            endsAt: updated.subscription.endsAt,
            plan: updated.subscription.plan,
          }
        : null,
    });
  } catch (e) {
    console.error("[super.tenants.update]", e);
    return error("Failed to update tenant", 500);
  }
}
