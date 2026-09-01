import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { json, error } from "@/lib/server";
import { createSession, SESSION_COOKIE, COOKIE_OPTIONS } from "@/lib/session";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Verifies credentials against the DB (bcrypt), sets a signed httpOnly
 * session cookie, and returns the user (with permissions + menu items).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return error("Email and password are required", 400);
    }

    const user = await db.user.findFirst({
      where: { email: email.toLowerCase().trim() },
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
      return error("Invalid email or password", 401);
    }

    // Use bcrypt to verify the password
    const { default: bcrypt } = await import("bcryptjs");
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) {
      return error("Invalid email or password", 401);
    }

    // Set the session cookie
    const session = createSession(user.id);
    const c = await cookies();
    c.set(SESSION_COOKIE, session, COOKIE_OPTIONS);

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Build response with permissions + menu items
    const permissions =
      user.roleRef?.permissions.map((rp) => rp.permission.key) || [];
    const menuItems = user.roleRef?.menuItems
      ? JSON.parse(user.roleRef.menuItems)
      : DEFAULT_ROLE_PERMISSIONS[user.role]?.menuItems || [];

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: "login",
        entity: "auth",
        details: `${user.name} logged in`,
      },
    });

    return json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleRef?.id || null,
      avatar: user.avatar,
      phone: user.phone,
      active: user.active,
      isSuperAdmin: user.roleRef?.isSuperAdmin || user.role === "super_admin",
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
  } catch (e) {
    return error((e as Error).message || "Login failed", 500);
  }
}
