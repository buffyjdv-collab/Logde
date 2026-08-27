import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking } from "@/lib/formatters";
import { withCreatedBy, BOOKING_INCLUDE } from "@/lib/booking-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = (body.reason as string) || "Cancelled by staff";

    const booking = await db.booking.findFirst({
      where: { id, tenantId },
    });
    if (!booking) return error("Booking not found", 404);

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    const updated = await db.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: BOOKING_INCLUDE,
    });

    // Free up the room: set to cleaning if it was occupied, otherwise available
    const room = await db.room.findUnique({ where: { id: booking.roomId } });
    if (room) {
      const newStatus = room.status === "occupied" ? "cleaning" : "available";
      await db.room.update({
        where: { id: booking.roomId },
        data: { status: newStatus },
      });
    }

    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "cancel",
        entity: "booking",
        entityId: booking.id,
        details: `Cancelled booking ${booking.bookingCode}: ${reason}`,
      },
    });

    await db.notification.create({
      data: {
        tenantId,
        type: "cancellation",
        title: "Booking cancelled",
        message: `Booking ${booking.bookingCode} was cancelled`,
      },
    });

    return json(formatBooking(withCreatedBy(updated)));
  } catch (e) {
    console.error("[bookings.cancel]", e);
    return error("Failed to cancel booking", 500);
  }
}
