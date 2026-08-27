"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck, Plus, Eye, LogIn, LogOut, Ban, ChevronLeft, ChevronRight,
  BedDouble, User, Mail, MapPin, Clock, FileText, MoreVertical,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { bookingsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  BOOKING_STATUS, BOOKING_SOURCES, formatCurrency, formatDate, daysBetween,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Booking, BookingStatus } from "@/lib/types";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  ...Object.entries(BOOKING_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
];

const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Sources" },
  ...Object.entries(BOOKING_SOURCES).map(([k, v]) => ({ value: k, label: v })),
];

// Map booking status -> calendar bar bg/text class
const CALENDAR_BAR_COLOR: Record<BookingStatus, string> = {
  confirmed: "bg-emerald-500 text-white",
  pending: "bg-amber-500 text-white",
  checked_in: "bg-sky-500 text-white",
  checked_out: "bg-zinc-400 text-white",
  cancelled: "bg-rose-500 text-white line-through",
  no_show: "bg-orange-500 text-white",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function BookingsView() {
  const queryClient = useQueryClient();
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("list");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelOpen, setCancelOpen] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "list", statusFilter === "all" ? undefined : statusFilter],
    queryFn: () =>
      bookingsApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (sourceFilter !== "all" && b.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.guest.name.toLowerCase().includes(q) ||
          b.bookingCode.toLowerCase().includes(q) ||
          b.guest.mobile.includes(q) ||
          b.room.number.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bookings, sourceFilter, search]);

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
      setSelectedBooking(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: (id: string) => bookingsApi.checkOut(id),
    onSuccess: () => {
      toast.success("Check-out complete. Invoice generated.");
      invalidateAll();
      setSelectedBooking(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: (b) => {
      toast.success(`Booking ${b.bookingCode} cancelled`);
      invalidateAll();
      setCancelOpen(null);
      setCancelReason("");
      setSelectedBooking(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calendar bookings — we want all bookings overlapping the visible month
  const { data: calendarBookings = [] } = useQuery({
    queryKey: ["bookings", "calendar", dateKey(startOfMonth(calendarMonth))],
    queryFn: () => bookingsApi.list({}),
    enabled: tab === "calendar",
  });

  // Build calendar grid
  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    // offset so first column is Monday (0=Mon, 6=Sun)
    const firstDayIdx = (monthStart.getDay() + 6) % 7;
    const daysInMonth = monthEnd.getDate();

    const cells: { date: Date | null; inMonth: boolean }[] = [];
    // Leading blanks
    for (let i = 0; i < firstDayIdx; i++) {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - (firstDayIdx - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        date: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day),
        inMonth: true,
      });
    }
    // trailing to fill to multiple of 7
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date!;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    // Cap at 6 rows
    return cells.slice(0, 42);
  }, [calendarMonth]);

  const bookingsForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return calendarBookings.filter((b) => {
      if (b.status === "cancelled" || b.status === "no_show") return false;
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      return ci <= dayEnd && co >= dayStart;
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bookings"
        description="Manage reservations, check-ins and check-outs"
        icon={<CalendarCheck className="h-5 w-5" />}
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setQuickAction("new_booking")}
            >
              <Plus className="h-4 w-4" /> New Booking
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5" /> Calendar
            </TabsTrigger>
          </TabsList>
          {tab === "list" && (
            <Input
              placeholder="Search guest, code, mobile, room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
          )}
          {tab === "calendar" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {calendarMonth.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setCalendarMonth(startOfMonth(new Date()))}
              >
                Today
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="list">
          <Card className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="p-4">
                <LoadingTable rows={6} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No bookings found"
                description="Try adjusting filters or create a new booking to get started."
                action={
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setQuickAction("new_booking")}
                  >
                    <Plus className="h-4 w-4" /> New Booking
                  </Button>
                }
              />
            ) : (
              <div className="max-h-[65vh] overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="pl-4">Code</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead className="text-center">Nights</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right pr-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((b) => {
                      const balance = Math.max(0, b.totalAmount - b.advancePaid);
                      return (
                        <TableRow
                          key={b.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedBooking(b)}
                        >
                          <TableCell className="pl-4 font-mono text-xs font-medium">
                            {b.bookingCode}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                {b.guest.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[140px]">
                                  {b.guest.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {b.guest.mobile}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{b.room.number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {b.room.roomType.name}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(b.checkIn)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(b.checkOut)}
                          </TableCell>
                          <TableCell className="text-center text-sm tabular-nums">
                            {daysBetween(b.checkIn, b.checkOut)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={b.status} map={BOOKING_STATUS} />
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(b.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {balance > 0 ? (
                              <span className="text-rose-600 font-medium">
                                {formatCurrency(balance)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Paid</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking(b);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                                </DropdownMenuItem>
                                {b.status === "confirmed" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkIn.mutate(b.id);
                                    }}
                                    disabled={checkIn.isPending}
                                  >
                                    <LogIn className="h-3.5 w-3.5 mr-2" /> Check-In
                                  </DropdownMenuItem>
                                )}
                                {b.status === "checked_in" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkOut.mutate(b.id);
                                    }}
                                    disabled={checkOut.isPending}
                                  >
                                    <LogOut className="h-3.5 w-3.5 mr-2" /> Check-Out
                                  </DropdownMenuItem>
                                )}
                                {!["cancelled", "checked_out", "no_show"].includes(
                                  b.status
                                ) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-rose-600 focus:text-rose-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelOpen(b);
                                      }}
                                    >
                                      <Ban className="h-3.5 w-3.5 mr-2" /> Cancel Booking
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {filtered.length > 50 && (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground text-center">
                Showing first 50 of {filtered.length} bookings
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="p-3 sm:p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-semibold text-muted-foreground py-1.5"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) => {
                if (!cell.date) {
                  return <div key={idx} className="min-h-[88px] rounded-lg bg-muted/30" />;
                }
                const dayBookings = bookingsForDay(cell.date);
                const isToday = isSameDay(cell.date, new Date());
                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[88px] rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden",
                      cell.inMonth
                        ? "bg-card"
                        : "bg-muted/30 border-muted",
                      isToday && "ring-1 ring-primary"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium",
                        cell.inMonth ? "text-foreground" : "text-muted-foreground/60",
                        isToday && "text-primary font-bold"
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayBookings.slice(0, 3).map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBooking(b)}
                          className={cn(
                            "block w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate hover:opacity-90 transition-opacity",
                            CALENDAR_BAR_COLOR[b.status]
                          )}
                          title={`${b.guest.name} · Room ${b.room.number}`}
                        >
                          <span className="font-medium">{b.room.number}</span>{" "}
                          {b.guest.name.split(" ")[0]}
                        </button>
                      ))}
                      {dayBookings.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{dayBookings.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t text-xs">
              {(["confirmed", "pending", "checked_in", "checked_out"] as BookingStatus[]).map(
                (s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        CALENDAR_BAR_COLOR[s].split(" ")[0]
                      )}
                    />
                    <span className="text-muted-foreground">
                      {BOOKING_STATUS[s].label}
                    </span>
                  </span>
                )
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Detail Dialog */}
      <BookingDetailDialog
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCheckIn={(id) => checkIn.mutate(id)}
        onCheckOut={(id) => checkOut.mutate(id)}
        onCancel={(b) => setCancelOpen(b)}
        pending={checkIn.isPending || checkOut.isPending}
      />

      {/* Cancel Booking Dialog */}
      <Dialog
        open={!!cancelOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCancelOpen(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" /> Cancel Booking
            </DialogTitle>
          </DialogHeader>
          {cancelOpen && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 bg-muted/30 text-sm">
                <p className="font-medium">{cancelOpen.guest.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cancelOpen.bookingCode} · Room {cancelOpen.room.number} ·{" "}
                  {formatDate(cancelOpen.checkIn)} → {formatDate(cancelOpen.checkOut)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Cancellation Reason</Label>
                <Textarea
                  placeholder="e.g. Guest changed plans, no-show, etc."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCancelOpen(null);
                setCancelReason("");
              }}
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancel.isPending}
              onClick={() =>
                cancelOpen &&
                cancel.mutate({ id: cancelOpen.id, reason: cancelReason.trim() })
              }
              className="gap-1.5"
            >
              <Ban className="h-4 w-4" />
              {cancel.isPending ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking Detail Dialog
// ---------------------------------------------------------------------------

interface DetailProps {
  booking: Booking | null;
  onClose: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onCancel: (b: Booking) => void;
  pending: boolean;
}

function BookingDetailDialog({
  booking,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
  pending,
}: DetailProps) {
  if (!booking) return null;
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  const roomTotal = booking.tariffPerDay * nights;
  const extraBedTotal = booking.extraBed ? booking.room.roomType.extraBedPrice * nights : 0;
  const subtotal = roomTotal + extraBedTotal;
  const discountAmount = (subtotal * (booking.discount || 0)) / 100;
  const taxable = subtotal - discountAmount;
  const tax = (taxable * (booking.taxRate || 0)) / 100;
  const balance = Math.max(0, booking.totalAmount - booking.advancePaid);

  return (
    <Dialog open={!!booking} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm text-muted-foreground">
                {booking.bookingCode}
              </span>
              <StatusBadge status={booking.status} map={BOOKING_STATUS} />
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-4">
          {/* Guest + Room grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Guest
              </p>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {booking.guest.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{booking.guest.name}</p>
                  <p className="text-xs text-muted-foreground">{booking.guest.mobile}</p>
                </div>
              </div>
              {booking.guest.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> {booking.guest.email}
                </p>
              )}
              {booking.guest.company && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {booking.guest.company}
                </p>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Room
              </p>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                  <BedDouble className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Room {booking.room.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.room.roomType.name} · Floor {booking.room.floor}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tariff / night</span>
                <span className="font-medium">{formatCurrency(booking.tariffPerDay)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">
                  {booking.room.roomType.capacity} guests
                </span>
              </div>
            </div>
          </div>

          {/* Stay details */}
          <div className="rounded-lg border p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <LogIn className="h-3 w-3" /> Check-In
                </p>
                <p className="font-medium">{formatDate(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <LogOut className="h-3 w-3" /> Check-Out
                </p>
                <p className="font-medium">{formatDate(booking.checkOut)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Nights
                </p>
                <p className="font-medium">{nights}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Guests
                </p>
                <p className="font-medium">
                  {booking.adults} adults
                  {booking.children > 0 && `, ${booking.children} kids`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
              <Badge variant="outline" className="text-xs capitalize">
                Source: {BOOKING_SOURCES[booking.source as keyof typeof BOOKING_SOURCES] || booking.source}
              </Badge>
              {booking.extraBed && (
                <Badge variant="outline" className="text-xs">Extra Bed</Badge>
              )}
              {booking.discount > 0 && (
                <Badge variant="outline" className="text-xs text-emerald-600">
                  {booking.discount}% off
                </Badge>
              )}
            </div>
            {booking.specialRequests && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                “{booking.specialRequests}”
              </p>
            )}
          </div>

          {/* Charges breakdown */}
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Charges Breakdown
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Room ({formatCurrency(booking.tariffPerDay)} × {nights})
              </span>
              <span className="font-medium">{formatCurrency(roomTotal)}</span>
            </div>
            {booking.extraBed && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra Bed</span>
                <span className="font-medium">{formatCurrency(extraBedTotal)}</span>
              </div>
            )}
            {booking.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount ({booking.discount}%)</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({booking.taxRate}%)</span>
              <span className="font-medium">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{formatCurrency(booking.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance Paid</span>
              <span className="text-emerald-600 font-medium">
                -{formatCurrency(booking.advancePaid)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Balance Due</span>
              <span
                className={cn(
                  "font-bold",
                  balance > 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {formatCurrency(balance)}
              </span>
            </div>
          </div>

          {/* Payment history */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Payment History
              </p>
              {booking.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      {p.method}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(p.createdAt, true)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 gap-2 flex-wrap">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {booking.status === "confirmed" && (
            <Button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={pending}
              onClick={() => onCheckIn(booking.id)}
            >
              <LogIn className="h-4 w-4" />
              {pending ? "Processing…" : "Check-In"}
            </Button>
          )}
          {booking.status === "checked_in" && (
            <Button
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
              disabled={pending}
              onClick={() => onCheckOut(booking.id)}
            >
              <LogOut className="h-4 w-4" />
              {pending ? "Processing…" : "Check-Out"}
            </Button>
          )}
          {!["cancelled", "checked_out", "no_show"].includes(booking.status) && (
            <Button
              variant="destructive"
              className="gap-1.5"
              onClick={() => onCancel(booking)}
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
