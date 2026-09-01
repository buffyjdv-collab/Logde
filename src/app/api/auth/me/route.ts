import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json, error, getUserId } from "@/lib/server";
import { formatUser } from "@/lib/formatters";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (from the session cookie) with
 * their role, permissions, menu items, and tenant.
 *
 * Returns 401 if not authenticated.
 */
export async function GET(_req: NextRequest) {
  const userId = await getUserId();

  if (!userId) {
    return error("Not authenticated", 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roleRef: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
      tenant: true,
    },
  });

  if (!user || !user.active) {
    return error("Not authenticated", 401);
  }

  const permissions =
    user.roleRef?.permissions.map((rp) => rp.permission.key) || [];
  const menuItems = user.roleRef?.menuItems
    ? JSON.parse(user.roleRef.menuItems)
    : DEFAULT_ROLE_PERMISSIONS[user.role]?.menuItems || [];

  return json({
    ...formatUser(user),
    isSuperAdmin: user.roleRef?.isSuperAdmin || user.role === "super_admin",
    roleId: user.roleRef?.id || null,
    permissions,
    menuItems,
    tenant: user.tenant
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          plan: user.tenant.plan,
          status: user.tenant.status,
          currency: user.tenant.currency,
        }
      : null,
  });
}
