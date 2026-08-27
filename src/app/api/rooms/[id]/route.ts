import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatRoom } from "@/lib/formatters";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, notes } = body as {
      status?: string;
      notes?: string;
    };

    const existing = await db.room.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Room not found", 404);

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const updated = await db.room.update({
      where: { id },
      data,
      include: { roomType: true, property: true },
    });

    // If room transitions to cleaning/maintenance, create a housekeeping task
    if (status && status !== existing.status) {
      if (status === "cleaning") {
        await db.housekeepingTask.create({
          data: {
            tenantId,
            roomId: id,
            status: "pending",
            priority: "normal",
            notes: "Auto-created from room status change to cleaning",
          },
        });
        await db.notification.create({
          data: {
            tenantId,
            type: "maintenance",
            title: "Room cleaning required",
            message: `Room ${updated.number} marked for cleaning`,
          },
        });
      } else if (status === "maintenance") {
        await db.housekeepingTask.create({
          data: {
            tenantId,
            roomId: id,
            status: "blocked",
            priority: "high",
            notes: "Auto-created from room status change to maintenance",
          },
        });
        await db.notification.create({
          data: {
            tenantId,
            type: "maintenance",
            title: "Room under maintenance",
            message: `Room ${updated.number} set to maintenance`,
          },
        });
      }
    }

    return json(formatRoom(updated));
  } catch (e) {
    console.error("[rooms.update]", e);
    return error("Failed to update room", 500);
  }
}
