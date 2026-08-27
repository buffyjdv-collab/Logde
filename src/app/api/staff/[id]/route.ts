import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatUser } from "@/lib/formatters";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, role, phone, active, propertyId } = body as Record<
      string,
      unknown
    >;

    const existing = await db.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("User not found", 404);

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (phone !== undefined) data.phone = phone || null;
    if (active !== undefined) data.active = Boolean(active);
    if (propertyId !== undefined) data.propertyId = propertyId || null;

    const updated = await db.user.update({
      where: { id },
      data,
      include: { property: true },
    });

    return json(formatUser(updated));
  } catch (e) {
    console.error("[staff.update]", e);
    return error("Failed to update staff member", 500);
  }
}
