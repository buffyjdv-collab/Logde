import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId();
    const { id } = await params;

    const existing = await db.expense.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return error("Expense not found", 404);

    await db.expense.delete({ where: { id } });

    return json({ success: true });
  } catch (e) {
    console.error("[expenses.delete]", e);
    return error("Failed to delete expense", 500);
  }
}
