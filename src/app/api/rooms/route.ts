import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatRoom } from "@/lib/formatters";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const rooms = await db.room.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: { roomType: true, property: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    });

    return json(rooms.map(formatRoom));
  } catch (e) {
    console.error("[rooms.list]", e);
    return error("Failed to load rooms", 500);
  }
}
