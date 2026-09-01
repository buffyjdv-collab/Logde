import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authorize, json, error } from "@/lib/server";
import { formatUser } from "@/lib/formatters";

/**
 * PATCH /api/staff/[id]/role
 * Body: { roleId: string }
 * Sets the user's molecular roleId and also mirrors the role name onto the
 * legacy `role` field for backward compatibility with older code paths.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, tenantId } = await authorize("staff.manage");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { roleId } = body as { roleId?: string };

    if (!roleId) return error("roleId is required", 400);

    // The user must belong to the acting tenant.
    const user = await db.user.findFirst({ where: { id, tenantId } });
    if (!user) return error("User not found", 404);

    // The role must exist and belong to the same tenant (or be a system role
    // explicitly assigned to this tenant context — super-admin system roles
    // cannot be assigned to tenant users).
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) return error("Role not found", 404);
    if (role.tenantId && role.tenantId !== tenantId) {
      return error("Role not found", 404);
    }
    if (role.isSuperAdmin) {
      return error("Cannot assign a super-admin role to a tenant user", 400);
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        roleId,
        role: role.name, // legacy field mirror
      },
      include: { property: true, roleRef: { include: { permissions: { include: { permission: true } } } } },
    });

    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "update",
        entity: "user",
        entityId: id,
        details: `Assigned role "${role.label}" to ${updated.name}`,
      },
    });

    return json(formatUser(updated));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update user role";
    if (msg.startsWith("Forbidden:") || msg.startsWith("Unauthorized")) {
      return error(msg, 403);
    }
    console.error("[staff.role.update]", e);
    return error("Failed to update user role", 500);
  }
}
