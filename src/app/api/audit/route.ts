import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatAuditLog } from "@/lib/formatters";

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const logs = await db.auditLog.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return json(logs.map(formatAuditLog));
  } catch (e) {
    console.error("[audit.list]", e);
    return error("Failed to load audit logs", 500);
  }
}
