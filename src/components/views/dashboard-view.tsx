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
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { dashboardApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  ROOM_STATUS, BOOKING_STATUS, formatCurrency, formatDate,
} from "@/lib/constants";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Status → hex (mirrors ROOM_STATUS color order: available/occupied/reserved/cleaning/maintenance/blocked)
const ROOM_STATUS_HEX: Record<string, string> = {
  available: "#10b981",
  occupied: "#f43f5e",
  reserved: "#f59e0b",
  cleaning: "#0ea5e9",
  maintenance: "#f97316",
  blocked: "#a1a1aa",
};

function statusHex(status: string): string {
  return ROOM_STATUS_HEX[status] ?? "#a1a1aa";
}

// Tailwind class that targets the Progress indicator's data-slot and overrides its bg color.
// The actual color is provided via the `--pc` CSS variable on the Progress element's style.
const PROGRESS_INDICATOR_CLASS =
  "h-1.5 [&_[data-slot=progress-indicator]]:bg-[var(--pc)]";

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

  // Room status breakdown — only non-zero statuses
  const roomStatusItems = stats.roomStatusBreakdown.filter((s) => s.value > 0);
  const totalRoomsTracked = roomStatusItems.reduce((s, x) => s + x.value, 0) || 1;

  // Revenue trend — most recent 7 days
  const revenueTrendRecent = stats.revenueTrend.slice(-7);

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

      {/* Revenue vs Expenses table + Room status tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend table */}
        <Card className="lg:col-span-2 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
              <p className="text-xs text-muted-foreground">Last 14 days · most recent 7 shown</p>
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
          <div className="overflow-y-auto scrollbar-thin max-h-72 rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-right text-xs">Revenue</TableHead>
                  <TableHead className="text-right text-xs">Expenses</TableHead>
                  <TableHead className="text-right text-xs">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueTrendRecent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No revenue data available
                    </TableCell>
                  </TableRow>
                ) : (
                  revenueTrendRecent.map((day) => {
                    const net = day.revenue - day.expenses;
                    return (
                      <TableRow key={day.date} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-sm font-medium">
                          {formatDate(day.date)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-emerald-600 font-medium">
                          {formatCurrency(day.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-rose-600 font-medium">
                          {formatCurrency(day.expenses)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-sm tabular-nums font-semibold",
                            net >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {formatCurrency(net)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Room status tiles */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-1">Room Status</h3>
          <p className="text-xs text-muted-foreground mb-3">Current distribution</p>
          {roomStatusItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rooms tracked
            </p>
          ) : (
            <div className="space-y-3">
              {roomStatusItems.map((s) => {
                const pct = Math.round((s.value / totalRoomsTracked) * 100);
                const hex = statusHex(s.status);
                return (
                  <div key={s.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {pct}%
                        </span>
                        <span className="font-semibold tabular-nums">{s.value}</span>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={PROGRESS_INDICATOR_CLASS}
                      style={{ ["--pc" as string]: hex } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </div>
          )}
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

        {/* Occupancy by Floor table */}
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Occupancy by Floor</h3>
          {stats.occupancyByFloor.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No floor data available
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-1">Floor</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                    <TableHead className="text-right text-xs">Occ.</TableHead>
                    <TableHead className="text-right text-xs">Avail.</TableHead>
                    <TableHead className="text-right text-xs pr-1">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.occupancyByFloor.map((f) => {
                    const available = Math.max(0, f.total - f.occupied);
                    const pct = f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0;
                    const pctColor =
                      pct > 80
                        ? "text-rose-600"
                        : pct >= 50
                        ? "text-amber-600"
                        : "text-emerald-600";
                    return (
                      <TableRow key={f.floor} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-sm font-medium pl-1">Floor {f.floor}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{f.total}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-rose-600">
                          {f.occupied}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-emerald-600">
                          {available}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-sm tabular-nums font-semibold pr-1",
                            pctColor
                          )}
                        >
                          {pct}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
