import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isSuperAdmin, json, error } from "@/lib/server";
import { formatUser } from "@/lib/formatters";

/**
 * GET /api/super/audit
 * Query params:
 *   ?tenantId=<id>   (optional filter; defaults to all tenants)
 * Returns the most recent 100 cross-tenant audit logs with user + tenant
 * included, newest first.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");

    const where: object = tenantId ? { tenantId } : {};
    const logs = await db.auditLog.findMany({
      where,
      include: {
        user: { include: { property: true } },
        tenant: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json(
      logs.map((l) => ({
        id: l.id,
        tenantId: l.tenantId,
        userId: l.userId,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        details: l.details,
        createdAt: l.createdAt,
        user: l.user ? formatUser(l.user) : null,
        tenant: l.tenant
          ? {
              id: l.tenant.id,
              name: l.tenant.name,
              slug: l.tenant.slug,
              status: l.tenant.status,
            }
          : null,
      }))
    );
  } catch (e) {
    console.error("[super.audit.list]", e);
    return error("Failed to load platform audit logs", 500);
  }
}
