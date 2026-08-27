import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatExpense } from "@/lib/formatters";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const category = searchParams.get("category");

    const where: Record<string, unknown> = { tenantId };
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) (where.date as any).gte = new Date(from);
      if (to) (where.date as any).lte = new Date(to);
    }

    const expenses = await db.expense.findMany({
      where,
      include: { user: true },
      orderBy: { date: "desc" },
    });

    return json(expenses.map(formatExpense));
  } catch (e) {
    console.error("[expenses.list]", e);
    return error("Failed to load expenses", 500);
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    const body = await req.json();
    const {
      category,
      amount,
      description,
      method = "cash",
      date,
    } = body as Record<string, unknown>;

    if (!category || !amount) {
      return error("Category and amount are required", 400);
    }

    const firstUser = await db.user.findFirst({ where: { tenantId } });

    const expense = await db.expense.create({
      data: {
        tenantId,
        category: category as string,
        amount: Number(amount),
        description: (description as string) || null,
        method: method as string,
        date: date ? new Date(date as string) : new Date(),
        userId: firstUser?.id || null,
      },
      include: { user: true },
    });

    return json(formatExpense(expense), 201);
  } catch (e) {
    console.error("[expenses.create]", e);
    return error("Failed to create expense", 500);
  }
}
