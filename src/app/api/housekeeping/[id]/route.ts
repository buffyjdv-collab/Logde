import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatHousekeeping } from "@/lib/formatters";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, priority, assignedTo, notes } = body as Record<
      string,
      unknown
    >;

    const existing = await db.housekeepingTask.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Task not found", 404);

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (assignedTo !== undefined) {
      data.assignedTo = (assignedTo as string) || null;
    }
    if (notes !== undefined) data.notes = notes;

    // Status transitions
    if (status === "done" && existing.status !== "done") {
      data.completedAt = new Date();
      // Set room to available
      await db.room.update({
        where: { id: existing.roomId },
        data: { status: "available" },
      });
    } else if (status === "in_progress") {
      await db.room.update({
        where: { id: existing.roomId },
        data: { status: "cleaning" },
      });
    }

    const updated = await db.housekeepingTask.update({
      where: { id },
      data,
      include: {
        room: { include: { roomType: true, property: true } },
        user: true,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "update",
        entity: "housekeeping",
        entityId: id,
        details: `Updated housekeeping task status=${status || existing.status}`,
      },
    });

    return json(
      formatHousekeeping({ ...updated, assignedTo: updated.user })
    );
  } catch (e) {
    console.error("[housekeeping.update]", e);
    return error("Failed to update housekeeping task", 500);
  }
}
