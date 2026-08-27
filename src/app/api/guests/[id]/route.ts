import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatGuest, formatPayment } from "@/lib/formatters";
import { formatBooking, withCreatedBy } from "@/lib/booking-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const guest = await db.guest.findFirst({
      where: { id, tenantId },
      include: {
        bookings: {
          include: {
            guest: true,
            room: { include: { roomType: true, property: true } },
            user: true,
            payments: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!guest) return error("Guest not found", 404);

    // Fetch all payments for the guest across bookings
    const payments = await db.payment.findMany({
      where: { guestId: id, tenantId },
      include: { guest: true, booking: true },
      orderBy: { createdAt: "desc" },
    });

    return json({
      ...formatGuest(guest),
      bookings: guest.bookings.map((b) => formatBooking(withCreatedBy(b))),
      payments: payments.map(formatPayment),
    });
  } catch (e) {
    console.error("[guests.get]", e);
    return error("Failed to load guest", 500);
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

    const existing = await db.guest.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Guest not found", 404);

    const allowed = [
      "name",
      "mobile",
      "email",
      "address",
      "idType",
      "idNumber",
      "company",
      "gstNumber",
      "notes",
      "blacklisted",
    ];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) {
        data[k] =
          k === "blacklisted" ? Boolean(body[k]) : (body[k] as string | null);
      }
    }

    const updated = await db.guest.update({
      where: { id },
      data,
    });

    return json(formatGuest(updated));
  } catch (e) {
    console.error("[guests.update]", e);
    return error("Failed to update guest", 500);
  }
}
