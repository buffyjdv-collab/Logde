import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import type { ReportData } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") as
      | "7d"
      | "30d"
      | "90d"
      | "1y") || "30d";

    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };
    const days = daysMap[range] || 30;

    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const [payments, expenses, bookings, allRooms, outstandingBookings] =
      await Promise.all([
        db.payment.findMany({
          where: {
            tenantId,
            createdAt: { gte: start, lte: now },
            status: "completed",
          },
          select: {
            amount: true,
            method: true,
            createdAt: true,
            bookingId: true,
          },
        }),
        db.expense.findMany({
          where: { tenantId, date: { gte: start, lte: now } },
          select: { amount: true, category: true, date: true },
        }),
        db.booking.findMany({
          where: { tenantId, createdAt: { gte: start, lte: now } },
          select: {
            id: true,
            createdAt: true,
            totalAmount: true,
            roomId: true,
            room: { select: { number: true } },
          },
        }),
        db.room.findMany({
          where: { tenantId },
          select: { id: true },
        }),
        db.booking.findMany({
          where: {
            tenantId,
            status: { in: ["checked_in", "confirmed"] },
          },
          include: {
            guest: { select: { name: true } },
            room: { select: { number: true } },
          },
        }),
      ]);

    const totalRooms = allRooms.length;

    // ─── Daily Revenue ────────────────────────────────────────────────
    const dailyMap: Record<string, { revenue: number; bookings: number }> =
      {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dailyMap[d.toISOString().split("T")[0]] = { revenue: 0, bookings: 0 };
    }
    for (const p of payments) {
      const key = new Date(p.createdAt).toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].revenue += p.amount;
    }
    for (const b of bookings) {
      const key = new Date(b.createdAt).toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].bookings += 1;
    }
    const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue),
      bookings: v.bookings,
    }));

    // ─── Monthly Revenue & Expenses ───────────────────────────────────
    const monthMap: Record<
      string,
      { revenue: number; expenses: number }
    > = {};
    for (const p of payments) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, expenses: 0 };
      monthMap[key].revenue += p.amount;
    }
    for (const e of expenses) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!monthMap[key]) monthMap[key] = { revenue: 0, expenses: 0 };
      monthMap[key].expenses += e.amount;
    }
    const monthlyRevenue = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: Math.round(v.revenue),
        expenses: Math.round(v.expenses),
      }));

    // ─── Occupancy Trend ───────────────────────────────────────────────
    const occupancyTrend: { date: string; rate: number }[] = [];
    // Get checked_in bookings within the range OR overlapping the range
    const overlappingBookings = await db.booking.findMany({
      where: {
        tenantId,
        status: { in: ["checked_in", "checked_out"] },
        OR: [
          { checkIn: { gte: start, lte: now } },
          { checkOut: { gte: start, lte: now } },
          { AND: [{ checkIn: { lte: start } }, { checkOut: { gte: now } }] },
        ],
      },
      select: { checkIn: true, checkOut: true },
    });
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(12, 0, 0, 0);
      const occupied = overlappingBookings.filter(
        (b) => b.checkIn <= d && b.checkOut > d
      ).length;
      const rate =
        totalRooms > 0
          ? Math.round((occupied / totalRooms) * 100)
          : 0;
      occupancyTrend.push({
        date: d.toISOString().split("T")[0],
        rate,
      });
    }

    // ─── Payment Method Breakdown ──────────────────────────────────────
    const methodMap: Record<string, { amount: number; count: number }> = {};
    for (const p of payments) {
      if (!methodMap[p.method])
        methodMap[p.method] = { amount: 0, count: 0 };
      methodMap[p.method].amount += p.amount;
      methodMap[p.method].count += 1;
    }
    const paymentMethodBreakdown = Object.entries(methodMap).map(
      ([method, v]) => ({
        method,
        amount: Math.round(v.amount),
        count: v.count,
      })
    );

    // ─── Top Rooms (by booking count + revenue) ────────────────────────
    const roomMap: Record<string, { bookings: number; revenue: number }> =
      {};
    const paymentByBooking: Record<string, number> = {};
    for (const p of payments) {
      if (p.bookingId) {
        paymentByBooking[p.bookingId] =
          (paymentByBooking[p.bookingId] || 0) + p.amount;
      }
    }
    for (const b of bookings) {
      const key = b.room?.number || "Unknown";
      if (!roomMap[key]) roomMap[key] = { bookings: 0, revenue: 0 };
      roomMap[key].bookings += 1;
      roomMap[key].revenue += paymentByBooking[b.id] || 0;
    }
    const topRooms = Object.entries(roomMap)
      .map(([roomNumber, v]) => ({
        roomNumber,
        bookings: v.bookings,
        revenue: Math.round(v.revenue),
      }))
      .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
      .slice(0, 5);

    // ─── Expense Breakdown ─────────────────────────────────────────────
    const expMap: Record<string, number> = {};
    for (const e of expenses) {
      expMap[e.category] = (expMap[e.category] || 0) + e.amount;
    }
    const expenseBreakdown = Object.entries(expMap).map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
    }));

    // ─── Outstanding Payments ─────────────────────────────────────────
    const outstandingPayments = outstandingBookings
      .map((b) => {
        const balance = Math.max(0, b.totalAmount - b.advancePaid);
        return {
          bookingCode: b.bookingCode,
          guestName: b.guest?.name || "",
          roomNumber: b.room?.number || "",
          balance: Math.round(balance),
          checkOut: new Date(b.checkOut).toISOString(),
        };
      })
      .filter((b) => b.balance > 0);

    // ─── Totals ────────────────────────────────────────────────────────
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalBookings = bookings.length;
    const avgOccupancy =
      occupancyTrend.length > 0
        ? Math.round(
            occupancyTrend.reduce((s, o) => s + o.rate, 0) /
              occupancyTrend.length
          )
        : 0;

    const report: ReportData = {
      dailyRevenue,
      monthlyRevenue,
      occupancyTrend,
      paymentMethodBreakdown,
      topRooms,
      expenseBreakdown,
      outstandingPayments,
      totals: {
        totalRevenue: Math.round(totalRevenue),
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(totalRevenue - totalExpenses),
        totalBookings,
        avgOccupancy,
      },
    };

    return json(report);
  } catch (e) {
    console.error("[reports]", e);
    return error("Failed to generate report", 500);
  }
}
