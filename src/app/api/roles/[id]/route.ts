import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authorize, json, error } from "@/lib/server";
import { formatRole } from "@/lib/formatters";

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

/**
 * PATCH /api/roles/[id]
 * Body: { label?, description?, permissionKeys?, menuItems? }
 * - System roles (isSystem=true) cannot have their permissions changed (400).
 * - If `permissionKeys` provided, the existing RolePermission rows are deleted
 *   and recreated for the supplied keys.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, tenantId } = await authorize("staff.manage_roles");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { label, description, permissionKeys, menuItems } = body as {
      label?: string;
      description?: string;
      permissionKeys?: string[];
      menuItems?: string[];
    };

    const role = await db.role.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!role) return error("Role not found", 404);
    // Tenant isolation: a tenant user may only edit their own roles.
    // Super admin (role.isSuperAdmin) bypasses.
    if (role.tenantId && role.tenantId !== tenantId) {
      return error("Role not found", 404);
    }

    // System roles cannot have their permissions changed.
    if (role.isSystem && Array.isArray(permissionKeys)) {
      return error(
        "System roles cannot have their permissions changed",
        400
      );
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label;
    if (description !== undefined) data.description = description;
    if (Array.isArray(menuItems)) data.menuItems = JSON.stringify(menuItems);

    if (Array.isArray(permissionKeys)) {
      const perms = permissionKeys.length
        ? await db.permission.findMany({
            where: { key: { in: permissionKeys } },
            select: { id: true, key: true },
          })
        : [];
      const unknown = permissionKeys.filter(
        (k) => !perms.some((p) => p.key === k)
      );
      if (unknown.length) {
        return error(`Unknown permission keys: ${unknown.join(", ")}`, 400);
      }
      const permIds = perms.map((p) => p.id);

      // Replace all RolePermission rows.
      await db.rolePermission.deleteMany({ where: { roleId: id } });
      if (permIds.length > 0) {
        await db.rolePermission.createMany({
          data: permIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
    }

    const updated = await db.role.update({
      where: { id },
      data,
      include: ROLE_INCLUDE,
    });

    await db.auditLog.create({
      data: {
        tenantId: role.tenantId ?? tenantId,
        userId,
        action: "update",
        entity: "role",
        entityId: id,
        details: `Updated role "${updated.label}"`,
      },
    });

    return json(
      formatRole({ ...updated, userCount: updated._count?.users ?? 0 })
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update role";
    if (msg.startsWith("Forbidden:") || msg.startsWith("Unauthorized")) {
      return error(msg, 403);
    }
    console.error("[roles.update]", e);
    return error("Failed to update role", 500);
  }
}

/**
 * DELETE /api/roles/[id]
 * - System roles cannot be deleted (400).
 * - RolePermission rows cascade automatically (onDelete: Cascade).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, tenantId } = await authorize("staff.manage_roles");
    const { id } = await params;

    const role = await db.role.findUnique({ where: { id } });
    if (!role) return error("Role not found", 404);
    if (role.tenantId && role.tenantId !== tenantId) {
      return error("Role not found", 404);
    }
    if (role.isSystem) {
      return error("System roles cannot be deleted", 400);
    }

    // Prevent deletion if any users are still on this role.
    const usersOnRole = await db.user.count({ where: { roleId: id } });
    if (usersOnRole > 0) {
      return error(
        `Cannot delete role — ${usersOnRole} user(s) are still assigned`,
        400
      );
    }

    await db.role.delete({ where: { id } });

    await db.auditLog.create({
      data: {
        tenantId: role.tenantId ?? tenantId,
        userId,
        action: "delete",
        entity: "role",
        entityId: id,
        details: `Deleted role "${role.label}"`,
      },
    });

    return json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to delete role";
    if (msg.startsWith("Forbidden:") || msg.startsWith("Unauthorized")) {
      return error(msg, 403);
    }
    console.error("[roles.delete]", e);
    return error("Failed to delete role", 500);
  }
}
