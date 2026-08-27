import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatNotification } from "@/lib/formatters";

export async function GET() {
  try {
    const tenantId = await getTenantId();
    const notifications = await db.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return json(notifications.map(formatNotification));
  } catch (e) {
    console.error("[notifications.list]", e);
    return error("Failed to load notifications", 500);
  }
}

export async function PATCH() {
  try {
    const tenantId = await getTenantId();
    await db.notification.updateMany({
      where: { tenantId, read: false },
      data: { read: true },
    });
    return json({ success: true });
  } catch (e) {
    console.error("[notifications.markAll]", e);
    return error("Failed to mark notifications read", 500);
  }
}
