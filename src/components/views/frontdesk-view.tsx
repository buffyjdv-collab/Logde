"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConciergeBell, LogIn, LogOut, CreditCard, Plus, BedDouble, Clock,
  AlertTriangle, CheckCircle2, Calendar as CalIcon,
  IndianRupee,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { bookingsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate, daysBetween } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Booking } from "@/lib/types";

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isOverdue(targetDate: string, kind: "in" | "out") {
  const d = new Date(targetDate);
  const now = new Date();
  // For check-in: overdue if check-in date was earlier than today
  // For check-out: overdue if check-out date is earlier than today
  if (kind === "in") {
    return (
      d.getFullYear() < now.getFullYear() ||
      d.getMonth() < now.getMonth() ||
      (d.getMonth() === now.getMonth() && d.getDate() < now.getDate())
    );
  }
  return (
    d.getFullYear() < now.getFullYear() ||
    d.getMonth() < now.getMonth() ||
    (d.getMonth() === now.getMonth() && d.getDate() < now.getDate())
  );
}

export function FrontDeskView() {
  const queryClient = useQueryClient();
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const [confirmCheckIn, setConfirmCheckIn] = useState<Booking | null>(null);

  const { data: confirmed = [], isLoading: loadingIn } = useQuery({
    queryKey: ["bookings", "frontdesk", "confirmed"],
    queryFn: () => bookingsApi.list({ status: "confirmed" }),
  });

  const { data: checkedIn = [], isLoading: loadingOut } = useQuery({
    queryKey: ["bookings", "frontdesk", "checked_in"],
    queryFn: () => bookingsApi.list({ status: "checked_in" }),
  });

  // Sort: today first, then overdue, then future
  const checkInQueue = useMemo(() => {
    return [...confirmed]
      .map((b) => ({
        b,
        today: isToday(b.checkIn),
        overdue: isOverdue(b.checkIn, "in"),
      }))
      .sort((a, z) => {
        if (a.today && !z.today) return -1;
        if (!a.today && z.today) return 1;
        if (a.overdue && !z.overdue) return -1;
        if (!a.overdue && z.overdue) return 1;
        return new Date(a.b.checkIn).getTime() - new Date(z.b.checkIn).getTime();
      });
  }, [confirmed]);

  const checkOutQueue = useMemo(() => {
    return [...checkedIn]
      .map((b) => ({
        b,
        today: isToday(b.checkOut),
        overdue: isOverdue(b.checkOut, "out"),
      }))
      .sort((a, z) => {
        if (a.today && !z.today) return -1;
        if (!a.today && z.today) return 1;
        if (a.overdue && !z.overdue) return -1;
        if (!a.overdue && z.overdue) return 1;
        return new Date(a.b.checkOut).getTime() - new Date(z.b.checkOut).getTime();
      });
  }, [checkedIn]);

  const arrivalsToday = checkInQueue.filter((x) => x.today).length;
  const departuresToday = checkOutQueue.filter((x) => x.today).length;
  const overdueArrivals = checkInQueue.filter((x) => x.overdue).length;
  const overdueDepartures = checkOutQueue.filter((x) => x.overdue).length;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  };

  const checkIn = useMutation({
    mutationFn: (id: string) => bookingsApi.checkIn(id),
    onSuccess: (b) => {
      toast.success(`${b.guest.name} checked in to Room ${b.room.number}`);
      invalidateAll();
      setConfirmCheckIn(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Front Desk"
        description="Quick check-in and check-out workflow"
        icon={<ConciergeBell className="h-5 w-5" />}
      />

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Button
          variant="default"
          className="h-auto py-3 justify-start gap-3"
          onClick={() => setQuickAction("new_booking")}
        >
          <div className="rounded-lg bg-white/15 p-2">
            <Plus className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">New Booking</p>
            <p className="text-[10px] opacity-80">Create reservation</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 justify-start gap-3 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => setQuickAction("check_in")}
        >
          <div className="rounded-lg bg-emerald-500/15 p-2">
            <LogIn className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Check-In</p>
            <p className="text-[10px] opacity-70">Find & check-in guest</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 justify-start gap-3 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          onClick={() => setQuickAction("check_out")}
        >
          <div className="rounded-lg bg-amber-500/15 p-2">
            <LogOut className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Check-Out</p>
            <p className="text-[10px] opacity-70">Generate invoice</p>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 justify-start gap-3 border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
          onClick={() => setQuickAction("payment")}
        >
          <div className="rounded-lg bg-sky-500/15 p-2">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Payment</p>
            <p className="text-[10px] opacity-70">Record payment</p>
          </div>
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          label="Arrivals Today"
          value={arrivalsToday}
          icon={LogIn}
          accent="emerald"
          hint={overdueArrivals > 0 ? `${overdueArrivals} overdue` : "On schedule"}
        />
        <StatCard
          label="Departures Today"
          value={departuresToday}
          icon={LogOut}
          accent="amber"
          hint={overdueDepartures > 0 ? `${overdueDepartures} overdue` : "On schedule"}
        />
        <StatCard
          label="In House"
          value={checkedIn.length}
          icon={BedDouble}
          accent="sky"
          hint="Currently checked-in"
        />
        <StatCard
          label="Awaiting Check-In"
          value={confirmed.length}
          icon={CalIcon}
          accent="violet"
          hint="Confirmed bookings"
        />
      </div>

      {/* Two-column queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Check-In Queue */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <LogIn className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Check-In Queue</h3>
                <p className="text-xs text-muted-foreground">
                  {checkInQueue.length} confirmed · {arrivalsToday} today
                  {overdueArrivals > 0 && (
                    <span className="text-rose-600"> · {overdueArrivals} overdue</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {loadingIn ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg border animate-pulse bg-muted/40"
                />
              ))}
            </div>
          ) : checkInQueue.length === 0 ? (
            <EmptyState
              icon={LogIn}
              title="No check-ins pending"
              description="All confirmed guests are checked in."
              className="py-8"
            />
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
              {checkInQueue.map(({ b, today, overdue }) => {
                const balance = Math.max(0, b.totalAmount - b.advancePaid);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      overdue
                        ? "border-rose-500/40 bg-rose-500/5"
                        : today
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-semibold">
                        {b.guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{b.guest.name}</p>
                          <span className="text-xs font-mono text-muted-foreground">
                            {b.bookingCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" /> Room {b.room.number}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalIcon className="h-3 w-3" />
                            {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-muted-foreground">
                            Advance:{" "}
                            <span className="font-medium text-emerald-600">
                              {formatCurrency(b.advancePaid)}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            Balance:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                balance > 0 ? "text-rose-600" : "text-emerald-600"
                              )}
                            >
                              {formatCurrency(balance)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {overdue ? (
                          <Badge
                            variant="outline"
                            className="text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px] gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </Badge>
                        ) : today ? (
                          <Badge
                            variant="outline"
                            className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px] gap-1"
                          >
                            <Clock className="h-3 w-3" /> Today
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Upcoming
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => setConfirmCheckIn(b)}
                        >
                          <LogIn className="h-3 w-3" /> Check In
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Check-Out Queue */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <LogOut className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Check-Out Queue</h3>
                <p className="text-xs text-muted-foreground">
                  {checkOutQueue.length} in-house · {departuresToday} today
                  {overdueDepartures > 0 && (
                    <span className="text-rose-600"> · {overdueDepartures} overdue</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {loadingOut ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg border animate-pulse bg-muted/40"
                />
              ))}
            </div>
          ) : checkOutQueue.length === 0 ? (
            <EmptyState
              icon={LogOut}
              title="No check-outs pending"
              description="No guests are currently checked in."
              className="py-8"
            />
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
              {checkOutQueue.map(({ b, today, overdue }) => {
                const nights = daysBetween(b.checkIn, b.checkOut);
                const balance = Math.max(0, b.totalAmount - b.advancePaid);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      overdue
                        ? "border-rose-500/40 bg-rose-500/5"
                        : today
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">
                        {b.guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{b.guest.name}</p>
                          <span className="text-xs font-mono text-muted-foreground">
                            {b.bookingCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3 w-3" /> Room {b.room.number}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {nights}n stay
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="text-muted-foreground">
                            Total:{" "}
                            <span className="font-medium">{formatCurrency(b.totalAmount)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Balance:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                balance > 0 ? "text-rose-600" : "text-emerald-600"
                              )}
                            >
                              {formatCurrency(balance)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {overdue ? (
                          <Badge
                            variant="outline"
                            className="text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px] gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" /> Overdue
                          </Badge>
                        ) : today ? (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[10px] gap-1"
                          >
                            <Clock className="h-3 w-3" /> Today
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            In House
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-xs"
                          onClick={() => setQuickAction("check_out")}
                        >
                          <LogOut className="h-3 w-3" /> Check Out
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Inline Check-In confirmation */}
      <Dialog
        open={!!confirmCheckIn}
        onOpenChange={(v) => !v && setConfirmCheckIn(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <LogIn className="h-5 w-5" /> Confirm Check-In
            </DialogTitle>
          </DialogHeader>
          {confirmCheckIn && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-semibold">
                    {confirmCheckIn.guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{confirmCheckIn.guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {confirmCheckIn.bookingCode} · {confirmCheckIn.guest.mobile}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Room</p>
                    <p className="text-sm font-medium">
                      {confirmCheckIn.room.number} · {confirmCheckIn.room.roomType.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stay</p>
                    <p className="text-sm font-medium">
                      {formatDate(confirmCheckIn.checkIn)} →{" "}
                      {formatDate(confirmCheckIn.checkOut)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-medium">
                      {formatCurrency(confirmCheckIn.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                    <p
                      className={cn(
                        "text-sm font-bold",
                        confirmCheckIn.totalAmount - confirmCheckIn.advancePaid > 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      )}
                    >
                      {formatCurrency(
                        Math.max(
                          0,
                          confirmCheckIn.totalAmount - confirmCheckIn.advancePaid
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
              {confirmCheckIn.totalAmount - confirmCheckIn.advancePaid > 0 && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-700 dark:text-sky-400 flex items-start gap-2">
                  <IndianRupee className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Outstanding balance of{" "}
                    <strong>
                      {formatCurrency(
                        confirmCheckIn.totalAmount - confirmCheckIn.advancePaid
                      )}
                    </strong>{" "}
                    — consider collecting payment during check-in.
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Room will be marked as <strong>Occupied</strong> and the booking
                status will become <strong>Checked-In</strong>.
              </p>
            </div>
          )}
          <DialogFooter className="border-t pt-4 gap-2">
            <Button variant="ghost" onClick={() => setConfirmCheckIn(null)}>
              Cancel
            </Button>
            {confirmCheckIn &&
              confirmCheckIn.totalAmount - confirmCheckIn.advancePaid > 0 && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
                  onClick={() => {
                    setConfirmCheckIn(null);
                    setQuickAction("payment");
                  }}
                >
                  <CreditCard className="h-4 w-4" /> Take Payment First
                </Button>
              )}
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={checkIn.isPending}
              onClick={() => confirmCheckIn && checkIn.mutate(confirmCheckIn.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {checkIn.isPending ? "Checking in…" : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
