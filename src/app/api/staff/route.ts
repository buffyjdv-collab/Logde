import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatUser } from "@/lib/formatters";

export async function GET() {
  try {
    const tenantId = await getTenantId();

    const users = await db.user.findMany({
      where: { tenantId },
      include: { property: true },
      orderBy: { createdAt: "asc" },
    });

    return json(users.map(formatUser));
  } catch (e) {
    console.error("[staff.list]", e);
    return error("Failed to load staff", 500);
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const { name, email, role, phone, propertyId } = body as Record<
      string,
      unknown
    >;

    if (!name || !email || !role) {
      return error("Name, email and role are required", 400);
    }

    // Check email uniqueness within tenant
    const existing = await db.user.findFirst({
      where: { tenantId, email: email as string },
    });
    if (existing) return error("Email already in use", 400);

    // Placeholder hashed password — auth handled elsewhere
    const placeholderPassword = `lh_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    const user = await db.user.create({
      data: {
        tenantId,
        name: name as string,
        email: email as string,
        role: role as string,
        phone: (phone as string) || null,
        password: placeholderPassword,
        propertyId: (propertyId as string) || null,
        active: true,
      },
      include: { property: true },
    });

    return json(formatUser(user), 201);
  } catch (e) {
    console.error("[staff.create]", e);
    return error("Failed to create staff member", 500);
  }
}
