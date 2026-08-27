import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking, withCreatedBy, BOOKING_INCLUDE } from "@/lib/booking-helpers";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    if (from || to) {
      where.checkIn = {};
      if (from) (where.checkIn as any).gte = new Date(from);
      if (to) (where.checkIn as any).lte = new Date(to);
    }

    const bookings = await db.booking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return json(bookings.map((b) => formatBooking(withCreatedBy(b))));
  } catch (e) {
    console.error("[bookings.list]", e);
    return error("Failed to load bookings", 500);
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const {
      guestId,
      roomId,
      checkIn,
      checkOut,
      adults = 1,
      children = 0,
      source = "walk_in",
      specialRequests,
      advancePaid = 0,
      extraBed = false,
      tariffPerDay,
      taxRate = 0,
    } = body as Record<string, unknown>;

    if (!guestId || !roomId || !checkIn || !checkOut) {
      return error("Missing required fields", 400);
    }

    // Compute nights
    const ci = new Date(checkIn as string);
    const co = new Date(checkOut as string);
    const nights = Math.max(
      1,
      Math.round((co.getTime() - ci.getTime()) / 86400000)
    );
    const tariff = Number(tariffPerDay) || 0;
    const totalAmount = tariff * nights;

    // Generate booking code
    const count = await db.booking.count({ where: { tenantId } });
    const bookingCode = `BK-${String(count + 1).padStart(4, "0")}`;

    // Find an admin user (for createdBy). Use the first user of the tenant.
    const firstUser = await db.user.findFirst({ where: { tenantId } });

    const booking = await db.booking.create({
      data: {
        tenantId,
        bookingCode,
        guestId: guestId as string,
        roomId: roomId as string,
        source: source as string,
        status: "confirmed",
        checkIn: ci,
        checkOut: co,
        adults: Number(adults),
        children: Number(children),
        numGuests: Number(adults) + Number(children),
        extraBed: Boolean(extraBed),
        tariffPerDay: tariff,
        totalAmount,
        advancePaid: Number(advancePaid) || 0,
        taxRate: Number(taxRate) || 0,
        specialRequests: (specialRequests as string) || null,
        createdBy: firstUser?.id || null,
      },
      include: BOOKING_INCLUDE,
    });

    // Set room to reserved
    await db.room.update({
      where: { id: roomId as string },
      data: { status: "reserved" },
    });

    // Create payment if advance > 0
    if (Number(advancePaid) > 0) {
      await db.payment.create({
        data: {
          tenantId,
          bookingId: booking.id,
          guestId: guestId as string,
          amount: Number(advancePaid),
          method: "cash",
          type: "advance",
          status: "completed",
          receivedBy: firstUser?.id || null,
        },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "create",
        entity: "booking",
        entityId: booking.id,
        details: `Created booking ${bookingCode}`,
      },
    });

    // Notification
    await db.notification.create({
      data: {
        tenantId,
        type: "booking",
        title: "New booking created",
        message: `Booking ${bookingCode} created`,
      },
    });

    return json(formatBooking(withCreatedBy(booking)), 201);
  } catch (e) {
    console.error("[bookings.create]", e);
    return error("Failed to create booking", 500);
  }
}
