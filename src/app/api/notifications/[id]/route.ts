import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatNotification } from "@/lib/formatters";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const existing = await db.notification.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Notification not found", 404);

    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    });

    return json(formatNotification(updated));
  } catch (e) {
    console.error("[notifications.markOne]", e);
    return error("Failed to mark notification read", 500);
  }
}
