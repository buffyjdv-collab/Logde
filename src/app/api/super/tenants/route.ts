import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  isSuperAdmin,
  getUserId,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";
import { formatTenant } from "@/lib/formatters";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * GET /api/super/tenants
 * Returns every tenant except the platform tenant, newest first.
 * Includes `_count` for users and bookings.
 */
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }

    const tenants = await db.tenant.findMany({
      where: { id: { not: PLATFORM_TENANT_ID } },
      include: {
        _count: { select: { users: true, bookings: true } },
        platformFeeConfig: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return json(
      tenants.map((t) => ({
        ...formatTenant(t),
        userCount: t._count?.users ?? 0,
        bookingCount: t._count?.bookings ?? 0,
        platformFeeConfig: t.platformFeeConfig ?? null,
      }))
    );
  } catch (e) {
    console.error("[super.tenants.list]", e);
    return error("Failed to load tenants", 500);
  }
}

/**
 * POST /api/super/tenants
 * Body: { name, contactEmail, contactPhone?, address?, plan?, feeType?, feeValue? }
 * Onboards a new tenant:
 * 1. Create tenant with unique slug (slugified name + random suffix).
 * 2. Create a default owner role with DEFAULT_ROLE_PERMISSIONS.owner.
 * 3. Create a PlatformFeeConfig (default feeType=percentage, feeValue=5).
 * Returns the tenant. Audit log entry written for the action.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      contactEmail,
      contactPhone,
      address,
      plan,
      feeType,
      feeValue,
    } = body as {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      plan?: string;
      feeType?: string;
      feeValue?: number;
    };

    if (!name || !contactEmail) {
      return error("name and contactEmail are required", 400);
    }

    // Build a unique slug.
    const baseSlug = slugify(name) || "tenant";
    const suffix = Math.random().toString(36).slice(2, 6);
    let slug = `${baseSlug}-${suffix}`;
    let attempt = 0;
    while (
      await db.tenant.findUnique({ where: { slug } })
    ) {
      attempt += 1;
      slug = `${baseSlug}-${suffix}${attempt}`;
    }

    const tenant = await db.tenant.create({
      data: {
        name,
        slug,
        contactEmail,
        contactPhone: contactPhone ?? null,
        address: address ?? null,
        plan: plan ?? "starter",
        status: "active",
        currency: "INR",
        timezone: "Asia/Kolkata",
      },
      include: { platformFeeConfig: true },
    });

    // Create a default owner role scoped to this tenant.
    const ownerCfg = DEFAULT_ROLE_PERMISSIONS.owner;
    const ownerRole = await db.role.create({
      data: {
        tenantId: tenant.id,
        name: "owner",
        label: ownerCfg.label,
        description: ownerCfg.description,
        isSystem: true,
        menuItems: JSON.stringify(ownerCfg.menuItems),
      },
    });
    const perms = ownerCfg.permissions.length
      ? await db.permission.findMany({
          where: { key: { in: ownerCfg.permissions } },
          select: { id: true },
        })
      : [];
    if (perms.length) {
      await db.rolePermission.createMany({
        data: perms.map((p) => ({
          roleId: ownerRole.id,
          permissionId: p.id,
        })),
      });
    }

    // Create the platform fee config for this tenant.
    const feeConfig = await db.platformFeeConfig.create({
      data: {
        tenantId: tenant.id,
        feeType: feeType ?? "percentage",
        feeValue: typeof feeValue === "number" ? feeValue : 5,
        active: true,
        notes: "Default platform fee configuration",
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        userId: (await getUserId()) ?? null,
        action: "create",
        entity: "tenant",
        entityId: tenant.id,
        details: `Onboarded tenant "${tenant.name}" (${tenant.plan} plan)`,
      },
    });

    return json(
      {
        ...formatTenant(tenant),
        platformFeeConfig: feeConfig,
        ownerRoleId: ownerRole.id,
      },
      201
    );
  } catch (e) {
    console.error("[super.tenants.create]", e);
    return error("Failed to create tenant", 500);
  }
}
