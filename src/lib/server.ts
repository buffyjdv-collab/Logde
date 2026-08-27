import { headers } from "next/headers";
import { db } from "./db";
import type { UserRole } from "./types";

// Default tenant for demo (single-tenant demo with multi-tenant-ready schema)
export const DEFAULT_TENANT_ID = "tenant_pinevalley";

/**
 * Get the tenant ID from the request header.
 * In a real multi-tenant app, this would be derived from the authenticated
 * user's session. Here we read from a header for flexibility.
 */
export async function getTenantId(): Promise<string> {
  const h = await headers();
  const tid = h.get("x-tenant-id");
  return tid || DEFAULT_TENANT_ID;
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
