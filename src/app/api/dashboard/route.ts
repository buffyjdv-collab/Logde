import { db } from "@/lib/db";
import { getTenantId, json, error } from "@/lib/server";
import { formatBooking, withCreatedBy } from "@/lib/booking-helpers";
import { ROOM_STATUS } from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";

export async function GET() {
  try {
    const tenantId = await getTenantId();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Parallel fetch of all required data
    const [
      rooms,
      allBookings,
      todayPayments,
      activeBookingsWithBal,
      guestsCount,
      activeBookingsCount,
      arrivals,
      departures,
      recentBookings,
      last14Payments,
      last14Expenses,
    ] = await Promise.all([
      db.room.findMany({
        where: { tenantId },
        select: { id: true, status: true, floor: true },
      }),
      db.booking.findMany({
        where: {
          tenantId,
          status: { in: ["confirmed", "checked_in"] },
          checkIn: { lte: endOfToday },
          checkOut: { gte: startOfToday },
        },
        select: { id: true, checkIn: true, checkOut: true, status: true },
      }),
      db.payment.findMany({
        where: {
          tenantId,
          createdAt: { gte: startOfToday, lte: endOfToday },
          status: "completed",
        },
        select: { amount: true },
      }),
      db.booking.findMany({
        where: {
          tenantId,
          status: { in: ["confirmed", "checked_in", "pending"] },
        },
        select: { totalAmount: true, advancePaid: true },
      }),
      db.guest.count({ where: { tenantId } }),
      db.booking.count({
        where: {
          tenantId,
          status: { in: ["confirmed", "checked_in", "pending"] },
        },
      }),
      db.booking.findMany({
        where: {
          tenantId,
          status: "confirmed",
          checkIn: { gte: startOfToday, lte: endOfToday },
        },
        include: {
          guest: true,
          room: { include: { roomType: true, property: true } },
        },
        orderBy: { checkIn: "asc" },
      }),
      db.booking.findMany({
        where: {
          tenantId,
          status: "checked_in",
          checkOut: { gte: startOfToday, lte: endOfToday },
        },
        include: {
          guest: true,
          room: { include: { roomType: true, property: true } },
        },
        orderBy: { checkOut: "asc" },
      }),
      db.booking.findMany({
        where: { tenantId },
        include: {
          guest: true,
          room: { include: { roomType: true, property: true } },
          user: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.payment.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(now.getTime() - 13 * 86400000),
            lte: now,
          },
          status: "completed",
        },
        select: { amount: true, createdAt: true },
      }),
      db.expense.findMany({
        where: {
          tenantId,
          date: {
            gte: new Date(now.getTime() - 13 * 86400000),
            lte: now,
          },
        },
        select: { amount: true, date: true },
      }),
    ]);

    // Group rooms by status
    const statusCounts: Record<string, number> = {
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0,
      blocked: 0,
    };
    for (const r of rooms) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }
    const totalRooms = rooms.length;
    const occupiedRooms = statusCounts.occupied || 0;

    // Check-ins/check-outs today
    const checkInsToday = allBookings.filter(
      (b) =>
        b.checkIn >= startOfToday &&
        b.checkIn <= endOfToday &&
        (b.status === "confirmed" || b.status === "checked_in")
    ).length;
    const checkOutsToday = allBookings.filter(
      (b) =>
        b.checkOut >= startOfToday &&
        b.checkOut <= endOfToday &&
        (b.status === "confirmed" || b.status === "checked_in")
    ).length;

    const todayRevenue = todayPayments.reduce((s, p) => s + p.amount, 0);
    const pendingPayments = activeBookingsWithBal.reduce(
      (s, b) => s + Math.max(0, b.totalAmount - b.advancePaid),
      0
    );

    const occupancyRate =
      totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Revenue trend for last 14 days
    const revenueTrend: { date: string; revenue: number; expenses: number }[] =
      [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const revenue = last14Payments
        .filter(
          (p) => p.createdAt >= day && p.createdAt <= dayEnd
        )
        .reduce((s, p) => s + p.amount, 0);
      const expenses = last14Expenses
        .filter((e) => e.date >= day && e.date <= dayEnd)
        .reduce((s, e) => s + e.amount, 0);

      revenueTrend.push({
        date: day.toISOString().split("T")[0],
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
      });
    }

    // Room status breakdown
    const roomStatusBreakdown = Object.entries(ROOM_STATUS).map(
      ([status, info]) => ({
        name: info.label,
        value: statusCounts[status] || 0,
        status,
      })
    );

    // Occupancy by floor
    const floorMap: Record<number, { total: number; occupied: number }> = {};
    for (const r of rooms) {
      if (!floorMap[r.floor])
        floorMap[r.floor] = { total: 0, occupied: 0 };
      floorMap[r.floor].total += 1;
      if (r.status === "occupied") floorMap[r.floor].occupied += 1;
    }
    const occupancyByFloor = Object.entries(floorMap).map(([floor, val]) => ({
      floor: Number(floor),
      total: val.total,
      occupied: val.occupied,
    }));

    const stats: DashboardStats = {
      totalRooms,
      availableRooms: statusCounts.available || 0,
      occupiedRooms,
      reservedRooms: statusCounts.reserved || 0,
      cleaningRooms: statusCounts.cleaning || 0,
      maintenanceRooms: statusCounts.maintenance || 0,
      blockedRooms: statusCounts.blocked || 0,
      checkInsToday,
      checkOutsToday,
      todayRevenue: Math.round(todayRevenue),
      pendingPayments: Math.round(pendingPayments),
      occupancyRate,
      totalGuests: guestsCount,
      activeBookings: activeBookingsCount,
      arrivals: arrivals.map((b) => formatBooking(withCreatedBy(b))),
      departures: departures.map((b) => formatBooking(withCreatedBy(b))),
      recentBookings: recentBookings.map((b) =>
        formatBooking(withCreatedBy(b))
      ),
      revenueTrend,
      roomStatusBreakdown,
      occupancyByFloor,
    };

    return json(stats);
  } catch (e) {
    console.error("[dashboard]", e);
    return error("Failed to load dashboard data", 500);
  }
}
