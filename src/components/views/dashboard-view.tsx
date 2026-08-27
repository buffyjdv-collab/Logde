"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BedDouble, DoorOpen, DoorClosed, LogIn, LogOut, IndianRupee,
  Clock, TrendingUp, Users, CalendarCheck, ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";
import { dashboardApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  ROOM_STATUS, BOOKING_STATUS, formatCurrency, formatDate,
} from "@/lib/constants";
import { LayoutDashboard } from "lucide-react";

const PIE_COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#0ea5e9", "#f97316", "#a1a1aa"];

export function DashboardView() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
    refetchInterval: 30000,
  });
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const setView = useAppStore((s) => s.setView);

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" icon={<LayoutDashboard className="h-5 w-5" />} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/50" />
          ))}
        </div>
        <LoadingTable rows={4} />
      </div>
    );
  }

  const occupancyColor =
    stats.occupancyRate >= 80 ? "rose" : stats.occupancyRate >= 50 ? "amber" : "emerald";

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back. Here's what's happening at your lodge today, ${formatDate(new Date())}.`}
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setQuickAction("new_booking")} className="gap-1.5">
              <CalendarCheck className="h-4 w-4" /> New Booking
            </Button>
            <Button size="sm" variant="outline" onClick={() => setView("frontdesk")}>
              Front Desk
            </Button>
          </div>
        }
      />

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Rooms"
          value={stats.totalRooms}
          icon={BedDouble}
          accent="violet"
          hint={`${stats.availableRooms} available now`}
        />
        <StatCard
          label="Occupied"
          value={stats.occupiedRooms}
          icon={DoorClosed}
          accent="rose"
          hint={`${stats.occupancyRate.toFixed(0)}% occupancy`}
        />
        <StatCard
          label="Available"
          value={stats.availableRooms}
          icon={DoorOpen}
          accent="emerald"
          hint={`${stats.reservedRooms} reserved`}
        />
        <StatCard
          label="Occupancy Rate"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          icon={TrendingUp}
          accent={occupancyColor}
          hint={`${stats.cleaningRooms} in cleaning`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Check-ins Today"
          value={stats.checkInsToday}
          icon={LogIn}
          accent="emerald"
        />
        <StatCard
          label="Check-outs Today"
          value={stats.checkOutsToday}
          icon={LogOut}
          accent="amber"
        />
        <StatCard
          label="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          icon={IndianRupee}
          accent="sky"
        />
        <StatCard
          label="Pending Payments"
          value={formatCurrency(stats.pendingPayments)}
          icon={Clock}
          accent="rose"
          hint="Outstanding balance"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <Card className="lg:col-span-2 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expenses
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.revenueTrend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDate(d).split(" ").slice(0, 2).join(" ")}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(d) => formatDate(d)}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#rev)"
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#exp)"
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Room status donut */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-1">Room Status</h3>
          <p className="text-xs text-muted-foreground mb-2">Current distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={stats.roomStatusBreakdown.filter((s) => s.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
              >
                {stats.roomStatusBreakdown
                  .filter((s) => s.value > 0)
                  .map((entry, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[Object.keys(ROOM_STATUS).indexOf(entry.status)] || "#a1a1aa"}
                    />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v} rooms`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
            {stats.roomStatusBreakdown
              .filter((s) => s.value > 0)
              .map((s) => (
                <div key={s.status} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        PIE_COLORS[Object.keys(ROOM_STATUS).indexOf(s.status)] || "#a1a1aa",
                    }}
                  />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium ml-auto">{s.value}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Arrivals */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <LogIn className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Today's Arrivals</h3>
                <p className="text-xs text-muted-foreground">{stats.arrivals.length} check-ins expected</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView("bookings")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {stats.arrivals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No arrivals today
              </p>
            ) : (
              stats.arrivals.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-semibold">
                    {b.guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Room {b.room.number} · {b.room.roomType.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={b.status} map={BOOKING_STATUS} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(b.totalAmount - b.advancePaid)} bal
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Today's Departures */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <LogOut className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Today's Departures</h3>
                <p className="text-xs text-muted-foreground">{stats.departures.length} check-outs expected</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView("bookings")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {stats.departures.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No departures today
              </p>
            ) : (
              stats.departures.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">
                    {b.guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Room {b.room.number} · Out {formatDate(b.checkOut)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={b.status} map={BOOKING_STATUS} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(b.totalAmount - b.advancePaid)} bal
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent bookings + occupancy by floor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Recent Bookings
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setView("bookings")}>
              All bookings <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.recentBookings.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-md hover:bg-muted/40 px-2 py-2 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {b.guest.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.guest.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.bookingCode} · Room {b.room.number} · {formatDate(b.checkIn)}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <StatusBadge status={b.status} map={BOOKING_STATUS} />
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">
                  {formatCurrency(b.totalAmount)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Occupancy by Floor</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.occupancyByFloor} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="floor"
                tickFormatter={(f) => `F${f}`}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={30}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, n) => [`${v} ${n === "occupied" ? "occupied" : "rooms"}`, n]}
              />
              <Bar dataKey="occupied" fill="#10b981" radius={[0, 4, 4, 0]} name="occupied" />
              <Bar dataKey="total" fill="#a1a1aa" radius={[0, 4, 4, 0]} name="total" fillOpacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
