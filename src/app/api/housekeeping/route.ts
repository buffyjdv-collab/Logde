import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatHousekeeping } from "@/lib/formatters";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const tasks = await db.housekeepingTask.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        room: { include: { roomType: true, property: true } },
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return json(tasks.map((t) => formatHousekeeping({ ...t, assignedTo: t.user })));
  } catch (e) {
    console.error("[housekeeping.list]", e);
    return error("Failed to load housekeeping tasks", 500);
  }
}
