import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatInvoice } from "@/lib/formatters";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const invoice = await db.invoice.findFirst({
      where: { id, tenantId },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true, property: true } },
          },
        },
      },
    });
    if (!invoice) return error("Invoice not found", 404);

    return json(formatInvoice(invoice));
  } catch (e) {
    console.error("[invoices.get]", e);
    return error("Failed to load invoice", 500);
  }
}
