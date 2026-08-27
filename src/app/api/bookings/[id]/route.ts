import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking } from "@/lib/formatters";
import { withCreatedBy, BOOKING_INCLUDE } from "@/lib/booking-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const booking = await db.booking.findFirst({
      where: { id, tenantId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) return error("Booking not found", 404);

    return json(formatBooking(withCreatedBy(booking)));
  } catch (e) {
    console.error("[bookings.get]", e);
    return error("Failed to load booking", 500);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.booking.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Booking not found", 404);

    const allowed = [
      "status",
      "checkIn",
      "checkOut",
      "adults",
      "children",
      "extraBed",
      "tariffPerDay",
      "totalAmount",
      "advancePaid",
      "discount",
      "taxRate",
      "specialRequests",
      "source",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        let v = body[key];
        if (key === "checkIn" || key === "checkOut") {
          if (v) v = new Date(v);
        }
        if (
          [
            "adults",
            "children",
            "tariffPerDay",
            "totalAmount",
            "advancePaid",
            "discount",
            "taxRate",
          ].includes(key)
        ) {
          v = Number(v);
        }
        if (key === "extraBed") v = Boolean(v);
        data[key] = v;
      }
    }

    // If tariff or dates changed, recompute totalAmount
    if (
      (data.tariffPerDay !== undefined || data.checkIn || data.checkOut) &&
      data.totalAmount === undefined
    ) {
      const tariff = Number(data.tariffPerDay ?? existing.tariffPerDay);
      const ci = data.checkIn ? (data.checkIn as Date) : existing.checkIn;
      const co = data.checkOut ? (data.checkOut as Date) : existing.checkOut;
      const nights = Math.max(
        1,
        Math.round((co.getTime() - ci.getTime()) / 86400000)
      );
      data.totalAmount = tariff * nights;
    }

    const updated = await db.booking.update({
      where: { id },
      data,
      include: BOOKING_INCLUDE,
    });

    return json(formatBooking(withCreatedBy(updated)));
  } catch (e) {
    console.error("[bookings.update]", e);
    return error("Failed to update booking", 500);
  }
}
