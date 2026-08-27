import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking, formatInvoice } from "@/lib/formatters";
import { withCreatedBy, BOOKING_INCLUDE } from "@/lib/booking-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const extraCharges = (body.extraCharges as
      | { label: string; amount: number }[]
      | undefined) || [];

    const booking = await db.booking.findFirst({
      where: { id, tenantId },
      include: { room: { include: { roomType: true, property: true } }, guest: true },
    });
    if (!booking) return error("Booking not found", 404);

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    // Compute nights
    const nights = Math.max(
      1,
      Math.round(
        (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86400000
      )
    );

    // Build invoice items
    const items: { label: string; qty: number; rate: number; amount: number }[] =
      [];
    const roomCharges = booking.tariffPerDay * nights;
    items.push({
      label: `Room (${booking.room.roomType.name})`,
      qty: nights,
      rate: booking.tariffPerDay,
      amount: roomCharges,
    });

    if (booking.extraBed) {
      const eb = booking.room.roomType.extraBedPrice || 0;
      items.push({
        label: "Extra Bed",
        qty: nights,
        rate: eb,
        amount: eb * nights,
      });
    }

    for (const ec of extraCharges) {
      items.push({
        label: ec.label,
        qty: 1,
        rate: Number(ec.amount),
        amount: Number(ec.amount),
      });
    }

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxAmount =
      Math.round(subtotal * (booking.taxRate / 100) * 100) / 100;
    const total = subtotal + taxAmount - booking.discount;
    const paidAmount = booking.advancePaid;
    const balance = Math.max(0, total - paidAmount);

    // Generate invoice code
    const invCount = await db.invoice.count({ where: { tenantId } });
    const invoiceCode = `INV-${String(invCount + 1).padStart(4, "0")}`;

    // Update booking
    const updated = await db.booking.update({
      where: { id: booking.id },
      data: {
        status: "checked_out",
        checkOutActual: new Date(),
      },
      include: BOOKING_INCLUDE,
    });

    // Create invoice
    const invoice = await db.invoice.create({
      data: {
        tenantId,
        invoiceCode,
        bookingId: booking.id,
        guestId: booking.guestId,
        subtotal,
        discount: booking.discount,
        taxAmount,
        total,
        paidAmount,
        balance,
        status: balance <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
        itemsJson: JSON.stringify(items),
      },
      include: { booking: { include: { guest: true } } },
    });

    // Set room to cleaning
    await db.room.update({
      where: { id: booking.roomId },
      data: { status: "cleaning" },
    });

    // Create housekeeping task for the room
    await db.housekeepingTask.create({
      data: {
        tenantId,
        roomId: booking.roomId,
        status: "pending",
        priority: "high",
        notes: `Checkout cleaning for ${booking.bookingCode}`,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "check_out",
        entity: "booking",
        entityId: booking.id,
        details: `Checked out booking ${booking.bookingCode}, invoice ${invoiceCode}`,
      },
    });

    await db.notification.create({
      data: {
        tenantId,
        type: "check_out",
        title: "Guest checked out",
        message: `Booking ${booking.bookingCode} checked out. Invoice ${invoiceCode} created.`,
      },
    });

    return json({
      booking: formatBooking(withCreatedBy(updated)),
      invoice: formatInvoice(invoice),
    });
  } catch (e) {
    console.error("[bookings.checkout]", e);
    return error("Failed to check out booking", 500);
  }
}
