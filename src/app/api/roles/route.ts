import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  authorize,
  isSuperAdmin,
  getTenantId,
  json,
  error,
} from "@/lib/server";
import { formatRole } from "@/lib/formatters";

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

/**
 * GET /api/roles
 * - Super admin sees system roles (tenantId=null) + every tenant role.
 * - Tenant users see only their own tenant's roles.
 * Each role includes parsed `menuItems`, its `permissions` list, and `userCount`.
 */
export async function GET() {
  try {
    const superAdmin = await isSuperAdmin();
    const tenantId = await getTenantId();

    let where: object;
    if (superAdmin) {
      where = {}; // everything (system + all tenants)
    } else {
      where = { tenantId };
    }

    const roles = await db.role.findMany({
      where,
      include: ROLE_INCLUDE,
      orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    });

    const formatted = roles.map((r) =>
      formatRole({
        ...r,
        userCount: r._count?.users ?? 0,
      })
    );

    return json(formatted);
  } catch (e) {
    console.error("[roles.list]", e);
    return error("Failed to load roles", 500);
  }
}

/**
 * POST /api/roles
 * Body: { name, label, description?, permissionKeys: string[], menuItems: string[] }
 * Creates a tenant-scoped role with the requested permissions and menu items.
 * Permission keys are resolved to Permission rows via `key`.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId } = await authorize("staff.manage_roles");
    const body = await req.json().catch(() => ({}));
    const {
      name,
      label,
      description,
      permissionKeys,
      menuItems,
    } = body as {
      name?: string;
      label?: string;
      description?: string;
      permissionKeys?: string[];
      menuItems?: string[];
    };

    if (!name || !label) {
      return error("Name and label are required", 400);
    }
    if (!Array.isArray(permissionKeys) || !Array.isArray(menuItems)) {
      return error("permissionKeys and menuItems must be arrays", 400);
    }

    // Uniqueness: (tenantId, name) is unique.
    const existing = await db.role.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (existing) {
      return error(`Role "${name}" already exists for this tenant`, 400);
    }

    // Resolve permission ids for the provided keys.
    const perms = permissionKeys.length
      ? await db.permission.findMany({
          where: { key: { in: permissionKeys } },
          select: { id: true, key: true },
        })
      : [];
    const permIds = perms.map((p) => p.id);
    // Detect any unknown keys so callers get useful feedback.
    const unknown = permissionKeys.filter(
      (k) => !perms.some((p) => p.key === k)
    );
    if (unknown.length) {
      return error(`Unknown permission keys: ${unknown.join(", ")}`, 400);
    }

    const role = await db.role.create({
      data: {
        tenantId,
        name,
        label,
        description: description ?? null,
        isSystem: false,
        isSuperAdmin: false,
        menuItems: JSON.stringify(menuItems),
        permissions:
          permIds.length > 0
            ? {
                create: permIds.map((permissionId) => ({ permissionId })),
              }
            : undefined,
      },
      include: ROLE_INCLUDE,
    });

    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "create",
        entity: "role",
        entityId: role.id,
        details: `Created role "${label}" with ${permIds.length} permissions`,
      },
    });

    return json(
      formatRole({ ...role, userCount: role._count?.users ?? 0 }),
      201
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create role";
    if (msg.startsWith("Forbidden:") || msg.startsWith("Unauthorized")) {
      return error(msg, 403);
    }
    console.error("[roles.create]", e);
    return error("Failed to create role", 500);
  }
}
