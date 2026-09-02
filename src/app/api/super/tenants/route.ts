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
 * Body: { name, contactEmail, contactPhone?, address?, plan?, feeType?, feeValue?, ownerName?, ownerEmail?, password? }
 * Onboards a new tenant:
 * 1. Create tenant with unique slug (slugified name + random suffix).
 * 2. Create a default owner role with DEFAULT_ROLE_PERMISSIONS.owner.
 * 3. Create the owner user (login credentials) so the tenant can log in.
 * 4. Create a PlatformFeeConfig (default feeType=percentage, feeValue=5).
 * Returns the tenant + the owner login credentials. Audit log entry written.
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
      ownerName,
      ownerEmail,
      password,
    } = body as {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
      plan?: string;
      feeType?: string;
      feeValue?: number;
      ownerName?: string;
      ownerEmail?: string;
      password?: string;
    };

    if (!name || !contactEmail) {
      return error("name and contactEmail are required", 400);
    }

    // Owner credentials default to the tenant's contact info.
    const finalOwnerName = ownerName?.trim() || name;
    const finalOwnerEmail = (ownerEmail?.trim() || contactEmail).toLowerCase();
    // Auto-generate a password if none provided (8-char alphanumeric).
    const finalPassword =
      password && password.length >= 6
        ? password
        : Math.random().toString(36).slice(2, 10);

    // Make sure the owner email isn't already taken by another user.
    const existing = await db.user.findFirst({
      where: { email: finalOwnerEmail },
    });
    if (existing) {
      return error(
        `A user with email "${finalOwnerEmail}" already exists. Use a different email.`,
        409
      );
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

    // Create the owner user with login credentials.
    const bcrypt = await import("bcryptjs");
    const passwordHash = bcrypt.hashSync(finalPassword, 10);
    const ownerUser = await db.user.create({
      data: {
        tenantId: tenant.id,
        name: finalOwnerName,
        email: finalOwnerEmail,
        password: passwordHash,
        role: "owner",
        roleId: ownerRole.id,
        phone: contactPhone ?? null,
        active: true,
        lastLogin: null,
      },
    });

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
        details: `Onboarded tenant "${tenant.name}" (${tenant.plan} plan) with owner ${finalOwnerEmail}`,
      },
    });

    return json(
      {
        ...formatTenant(tenant),
        platformFeeConfig: feeConfig,
        ownerRoleId: ownerRole.id,
        // Login credentials returned ONCE so the Super Admin can share them
        // with the tenant owner. The password is NOT stored in plaintext.
        credentials: {
          ownerName: finalOwnerName,
          email: finalOwnerEmail,
          password: finalPassword,
          userId: ownerUser.id,
          loginUrl: "/",
        },
      },
      201
    );
  } catch (e) {
    console.error("[super.tenants.create]", e);
    return error("Failed to create tenant", 500);
  }
}
