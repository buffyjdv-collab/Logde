import { headers, cookies } from "next/headers";
import { db } from "./db";
import type { UserRole } from "./types";
import { SESSION_COOKIE, verifySession } from "./session";

// Default tenant for demo (single-tenant demo with multi-tenant-ready schema)
export const DEFAULT_TENANT_ID = "tenant_pinevalley";
export const PLATFORM_TENANT_ID = "tenant_platform";
export const SUPER_ADMIN_USER_ID = "user_superadmin";

/**
 * Get the tenant ID from the request header (client may switch context).
 */
export async function getTenantId(): Promise<string> {
  const h = await headers();
  const tid = h.get("x-tenant-id");
  return tid || DEFAULT_TENANT_ID;
}

/**
 * Get the acting user id from the signed httpOnly session cookie.
 * Falls back to the x-user-id header for backward compatibility during
 * the transition (demo quick-login).
 */
export async function getUserId(): Promise<string | null> {
  const c = await cookies();
  const cookieVal = c.get(SESSION_COOKIE)?.value;
  const fromCookie = verifySession(cookieVal);
  if (fromCookie) return fromCookie;
  const h = await headers();
  return h.get("x-user-id") || null;
}

/**
 * Get the acting user with their role + permissions.
 */
export async function getCurrentUser() {
  const uid = await getUserId();
  if (!uid) return null;
  const user = await db.user.findUnique({
    where: { id: uid },
    include: {
      roleRef: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });
  if (!user) return null;
  return user;
}

/**
 * Get the set of permission keys the acting user holds.
 */
export async function getUserPermissions(): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user || !user.roleRef) {
    // Fallback to legacy role-based coarse permissions
    return coarsePermissionsFor(user?.role);
  }
  return new Set(
    user.roleRef.permissions.map((rp) => rp.permission.key)
  );
}

/**
 * Coarse fallback permissions keyed off the legacy `role` field.
 */
function coarsePermissionsFor(role: string | undefined): Set<string> {
  if (!role) return new Set();
  // Give the legacy role a reasonable default set
  const map: Record<string, string[]> = {
    super_admin: ["*"],
    owner: ["dashboard.view","bookings.view","bookings.create","bookings.edit","bookings.checkin","bookings.checkout","bookings.cancel","rooms.view","rooms.edit_status","rooms.manage","guests.view","guests.create","guests.edit","frontdesk.view","housekeeping.view","housekeeping.update","payments.view","payments.create","payments.refund","expenses.view","expenses.create","expenses.delete","reports.view","reports.export","staff.view","staff.manage","staff.manage_roles","settings.view","settings.manage"],
    manager: ["dashboard.view","bookings.view","bookings.create","bookings.edit","bookings.checkin","bookings.checkout","bookings.cancel","rooms.view","rooms.edit_status","guests.view","guests.create","guests.edit","frontdesk.view","housekeeping.view","housekeeping.update","payments.view","payments.create","expenses.view","expenses.create","expenses.delete","reports.view","reports.export","staff.view","staff.manage","settings.view"],
    receptionist: ["dashboard.view","bookings.view","bookings.create","bookings.edit","bookings.checkin","bookings.checkout","rooms.view","rooms.edit_status","guests.view","guests.create","guests.edit","frontdesk.view","housekeeping.view","payments.view","payments.create"],
    housekeeping: ["dashboard.view","rooms.view","housekeeping.view","housekeeping.update"],
    accountant: ["dashboard.view","payments.view","payments.create","payments.refund","expenses.view","expenses.create","expenses.delete","reports.view","reports.export","bookings.view","guests.view"],
  };
  return new Set(map[role] || []);
}

/**
 * Check if the acting user has a specific permission.
 * Super admins (role.isSuperAdmin) automatically pass.
 */
export async function hasPermission(key: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.roleRef?.isSuperAdmin) return true;
  const perms = await getUserPermissions();
  return perms.has("*") || perms.has(key);
}

/**
 * Authorize a request — throws if the user lacks the permission.
 * Use in API routes: `await authorize("bookings.create")`.
 */
export async function authorize(key: string): Promise<{ userId: string; tenantId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: not authenticated");
  if (user.roleRef?.isSuperAdmin) {
    return { userId: user.id, tenantId: user.tenantId };
  }
  const perms = await getUserPermissions();
  if (!perms.has("*") && !perms.has(key)) {
    throw new Error(`Forbidden: missing permission "${key}"`);
  }
  return { userId: user.id, tenantId: user.tenantId };
}

/**
 * Is the acting user a super admin?
 */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user?.roleRef?.isSuperAdmin;
}

/**
 * Ensure the tenant exists, returning it or throwing.
 */
export async function requireTenant(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

/**
 * Helper for JSON responses.
 */
export function json<T>(data: T, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Error response helper.
 */
export function error(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Role hierarchy for permission checks
export const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 100,
  owner: 90,
  manager: 70,
  accountant: 50,
  receptionist: 40,
  housekeeping: 30,
};

export function hasRole(current: UserRole, required: UserRole): boolean {
  return ROLE_PRIORITY[current] >= ROLE_PRIORITY[required];
}
