import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatPayment } from "@/lib/formatters";

const PAYMENT_INCLUDE = {
  guest: true,
  booking: {
    include: {
      guest: true,
      room: { include: { roomType: true, property: true } },
    },
  },
};

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { tenantId };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as any).gte = new Date(from);
      if (to) (where.createdAt as any).lte = new Date(to);
    }

    const payments = await db.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return json(payments.map(formatPayment));
  } catch (e) {
    console.error("[payments.list]", e);
    return error("Failed to load payments", 500);
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const {
      bookingId,
      guestId,
      amount,
      method = "cash",
      type = "advance",
      reference,
      notes,
    } = body as Record<string, unknown>;

    if (!amount || Number(amount) <= 0) {
      return error("A positive amount is required", 400);
    }

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    // Resolve guestId from booking if not provided
    let finalGuestId = (guestId as string) || null;
    if (bookingId && !finalGuestId) {
      const b = await db.booking.findFirst({
        where: { id: bookingId as string, tenantId },
        select: { guestId: true },
      });
      if (b) finalGuestId = b.guestId;
    }

    const payment = await db.payment.create({
      data: {
        tenantId,
        bookingId: (bookingId as string) || null,
        guestId: finalGuestId,
        amount: Number(amount),
        method: method as string,
        type: type as string,
        reference: (reference as string) || null,
        notes: (notes as string) || null,
        status: "completed",
        receivedBy: firstUser?.id || null,
      },
      include: PAYMENT_INCLUDE,
    });

    // If advance against a booking, update booking.advancePaid
    if (bookingId && type === "advance") {
      const booking = await db.booking.findFirst({
        where: { id: bookingId as string, tenantId },
        select: { advancePaid: true },
      });
      if (booking) {
        await db.booking.update({
          where: { id: bookingId as string },
          data: { advancePaid: booking.advancePaid + Number(amount) },
        });
      }
    }

    await db.auditLog.create({
      data: {
        tenantId,
        userId: firstUser?.id || null,
        action: "create",
        entity: "payment",
        entityId: payment.id,
        details: `Recorded payment of ₹${amount} (${method})`,
      },
    });

    return json(formatPayment(payment), 201);
  } catch (e) {
    console.error("[payments.create]", e);
    return error("Failed to create payment", 500);
  }
}
