import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatGuest } from "@/lib/formatters";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    const where: Record<string, unknown> = { tenantId };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const guests = await db.guest.findMany({
      where,
      include: {
        bookings: {
          select: {
            id: true,
            totalAmount: true,
            advancePaid: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = guests.map((g) => {
      const bookingsCount = g.bookings.length;
      const totalSpent = g.bookings.reduce(
        (s, b) => s + (b.totalAmount || 0),
        0
      );
      const lastStay = g.bookings[0]?.createdAt || null;
      const formatted = formatGuest(g);
      return {
        ...formatted,
        bookingsCount,
        totalSpent: Math.round(totalSpent),
        lastStay: lastStay ? new Date(lastStay).toISOString() : null,
      };
    });

    return json(result);
  } catch (e) {
    console.error("[guests.list]", e);
    return error("Failed to load guests", 500);
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const {
      name,
      mobile,
      email,
      address,
      idType,
      idNumber,
      company,
      gstNumber,
      notes,
      blacklisted,
    } = body as Record<string, unknown>;

    if (!name || !mobile) {
      return error("Name and mobile are required", 400);
    }

    const guest = await db.guest.create({
      data: {
        tenantId,
        name: name as string,
        mobile: mobile as string,
        email: (email as string) || null,
        address: (address as string) || null,
        idType: (idType as string) || null,
        idNumber: (idNumber as string) || null,
        company: (company as string) || null,
        gstNumber: (gstNumber as string) || null,
        notes: (notes as string) || null,
        blacklisted: Boolean(blacklisted),
      },
    });

    return json(formatGuest(guest), 201);
  } catch (e) {
    console.error("[guests.create]", e);
    return error("Failed to create guest", 500);
  }
}
