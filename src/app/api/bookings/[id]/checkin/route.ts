import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking } from "@/lib/formatters";
import { withCreatedBy, BOOKING_INCLUDE } from "@/lib/booking-helpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const booking = await db.booking.findFirst({
      where: { id, tenantId },
    });
    if (!booking) return error("Booking not found", 404);

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    const updated = await db.booking.update({
      where: { id },
      data: {
        status: "checked_in",
        checkInActual: new Date(),
      },
      include: BOOKING_INCLUDE,
    });

    // Mark room as occupied
    await db.room.update({
      where: { id: booking.roomId },
      data: { status: "occupied" },
    });

    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "check_in",
        entity: "booking",
        entityId: booking.id,
        details: `Checked in booking ${booking.bookingCode}`,
      },
    });

    await db.notification.create({
      data: {
        tenantId,
        type: "check_in",
        title: "Guest checked in",
        message: `Booking ${booking.bookingCode} checked in`,
      },
    });

    return json(formatBooking(withCreatedBy(updated)));
  } catch (e) {
    console.error("[bookings.checkin]", e);
    return error("Failed to check in booking", 500);
  }
}
