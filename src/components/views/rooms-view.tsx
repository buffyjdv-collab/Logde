"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BedDouble, Plus, Users, Wrench, Sparkles, DoorOpen, DoorClosed,
  CalendarCheck, Phone,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { roomsApi, bookingsApi } from "@/lib/api";
import {
  ROOM_STATUS, BOOKING_STATUS, formatCurrency, formatDate, daysBetween,
} from "@/lib/constants";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Room, RoomStatus, Booking } from "@/lib/types";

// Status → subtle bg + ring for room cards
const ROOM_CARD_THEME: Record<
  RoomStatus,
  { card: string; ring: string; label: string; pillActive: string; pillIdle: string }
> = {
  available: {
    card: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30",
    ring: "ring-emerald-500/20",
    label: "Available",
    pillActive: "bg-emerald-500 text-white border-emerald-500",
    pillIdle: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10",
  },
  occupied: {
    card: "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30",
    ring: "ring-rose-500/20",
    label: "Occupied",
    pillActive: "bg-rose-500 text-white border-rose-500",
    pillIdle: "border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10",
  },
  reserved: {
    card: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30",
    ring: "ring-amber-500/20",
    label: "Reserved",
    pillActive: "bg-amber-500 text-white border-amber-500",
    pillIdle: "border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10",
  },
  cleaning: {
    card: "bg-sky-500/5 hover:bg-sky-500/10 border-sky-500/30",
    ring: "ring-sky-500/20",
    label: "Cleaning",
    pillActive: "bg-sky-500 text-white border-sky-500",
    pillIdle: "border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10",
  },
  maintenance: {
    card: "bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/30",
    ring: "ring-orange-500/20",
    label: "Maintenance",
    pillActive: "bg-orange-500 text-white border-orange-500",
    pillIdle: "border-orange-500/30 text-orange-700 dark:text-orange-400 hover:bg-orange-500/10",
  },
  blocked: {
    card: "bg-zinc-500/5 hover:bg-zinc-500/10 border-zinc-500/30",
    ring: "ring-zinc-500/20",
    label: "Blocked",
    pillActive: "bg-zinc-500 text-white border-zinc-500",
    pillIdle: "border-zinc-500/30 text-zinc-700 dark:text-zinc-400 hover:bg-zinc-500/10",
  },
};

const STATUS_PILLS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...Object.entries(ROOM_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
];

export function RoomsView() {
  const queryClient = useQueryClient();
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms", "list", statusFilter],
    queryFn: () =>
      roomsApi.list(statusFilter === "all" ? undefined : statusFilter),
  });

  // Fetch all bookings to find current for the selected room
  const { data: allBookings = [] } = useQuery({
    queryKey: ["bookings", "for-rooms"],
    queryFn: () => bookingsApi.list({}),
    enabled: !!selectedRoom,
  });

  // Group by floor
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms.forEach((r) => {
      if (!map.has(r.floor)) map.set(r.floor, []);
      map.get(r.floor)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [rooms]);

  // Stats
  const stats = useMemo(() => {
    const s = {
      total: rooms.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0,
    };
    rooms.forEach((r) => {
      if (r.status === "available") s.available++;
      else if (r.status === "occupied") s.occupied++;
      else if (r.status === "reserved") s.reserved++;
      else if (r.status === "cleaning") s.cleaning++;
      else if (r.status === "maintenance") s.maintenance++;
    });
    return s;
  }, [rooms]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoomStatus }) =>
      roomsApi.update(id, { status }),
    onSuccess: (room) => {
      toast.success(`Room ${room.number} marked as ${ROOM_STATUS[room.status].label}`);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      setSelectedRoom(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentBookingForRoom = (roomId: string): Booking | undefined => {
    return allBookings.find(
      (b) =>
        b.room.id === roomId &&
        ["confirmed", "checked_in"].includes(b.status)
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms"
        description="Visual room status across all floors"
        icon={<BedDouble className="h-5 w-5" />}
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setQuickAction("new_booking")}
          >
            <Plus className="h-4 w-4" /> New Booking
          </Button>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatCard label="Total" value={stats.total} icon={BedDouble} accent="violet" />
        <StatCard label="Available" value={stats.available} icon={DoorOpen} accent="emerald" />
        <StatCard label="Occupied" value={stats.occupied} icon={DoorClosed} accent="rose" />
        <StatCard label="Reserved" value={stats.reserved} icon={CalendarCheck} accent="amber" />
        <StatCard label="Cleaning" value={stats.cleaning} icon={Sparkles} accent="sky" />
        <StatCard label="Maintenance" value={stats.maintenance} icon={Wrench} accent="orange" />
      </div>

      {/* Filter pills + legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_PILLS.map((p) => {
            const isActive = statusFilter === p.value;
            const theme = p.value !== "all" ? ROOM_CARD_THEME[p.value as RoomStatus] : null;
            return (
              <button
                key={p.value}
                onClick={() => setStatusFilter(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  isActive
                    ? theme
                      ? theme.pillActive
                      : "bg-primary text-primary-foreground border-primary"
                    : theme
                      ? theme.pillIdle
                      : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {Object.entries(ROOM_STATUS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", v.dot)} />
              <span className="text-muted-foreground">{v.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Floor view */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="h-36 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms found"
          description="Try a different status filter."
        />
      ) : (
        <div className="space-y-5">
          {floors.map(([floor, floorRooms]) => (
            <div key={floor}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-semibold">
                  Floor {floor}
                </div>
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {floorRooms.length} rooms
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {floorRooms.map((room) => {
                  const theme = ROOM_CARD_THEME[room.status];
                  return (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={cn(
                        "text-left rounded-xl border p-3 transition-all hover:shadow-md ring-1 ring-transparent",
                        theme.card,
                        theme.ring
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-2xl font-bold tracking-tight">
                            {room.number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {room.roomType.name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full mt-1.5",
                            ROOM_STATUS[room.status].dot
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {room.roomType.capacity}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(room.roomType.basePrice)}
                          <span className="text-muted-foreground font-normal">/n</span>
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mt-2 text-[10px] font-medium uppercase tracking-wide",
                          `text-${ROOM_STATUS[room.status].color}-700 dark:text-${ROOM_STATUS[room.status].color}-400`
                        )}
                      >
                        {ROOM_STATUS[room.status].label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room detail / status change dialog */}
      <RoomDetailDialog
        room={selectedRoom}
        currentBooking={selectedRoom ? currentBookingForRoom(selectedRoom.id) : undefined}
        onClose={() => setSelectedRoom(null)}
        onUpdate={(status) =>
          selectedRoom && updateStatus.mutate({ id: selectedRoom.id, status })
        }
        pending={updateStatus.isPending}
        onNewBooking={() => {
          setSelectedRoom(null);
          setQuickAction("new_booking");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Room Detail Dialog
// ---------------------------------------------------------------------------

interface RoomDetailProps {
  room: Room | null;
  currentBooking?: Booking;
  onClose: () => void;
  onUpdate: (status: RoomStatus) => void;
  pending: boolean;
  onNewBooking: () => void;
}

function RoomDetailDialog({
  room,
  currentBooking,
  onClose,
  onUpdate,
  pending,
  onNewBooking,
}: RoomDetailProps) {
  const [newStatus, setNewStatus] = useState<RoomStatus>(room?.status || "available");
  const [trackedRoomId, setTrackedRoomId] = useState<string | undefined>(room?.id);

  // Reset newStatus when room changes (derived state during render — safe)
  if (room?.id !== trackedRoomId) {
    setTrackedRoomId(room?.id);
    setNewStatus(room?.status || "available");
  }

  if (!room) return null;
  const theme = ROOM_CARD_THEME[room.status];
  const nights = currentBooking
    ? daysBetween(currentBooking.checkIn, currentBooking.checkOut)
    : 0;
  const balance = currentBooking
    ? Math.max(0, currentBooking.totalAmount - currentBooking.advancePaid)
    : 0;
  const dirty = newStatus !== room.status;

  return (
    <Dialog open={!!room} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" /> Room {room.number}
            </span>
            <StatusBadge status={room.status} map={ROOM_STATUS} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-4">
          {/* Room type details */}
          <div className={cn("rounded-lg border p-3", theme.card)}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Room Type
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{room.roomType.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">{room.roomType.capacity} guests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tariff / night</span>
                <span className="font-semibold">
                  {formatCurrency(room.roomType.basePrice)}
                </span>
              </div>
              {room.roomType.extraBedPrice > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra bed</span>
                  <span className="font-medium">
                    {formatCurrency(room.roomType.extraBedPrice)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Floor</span>
                <span className="font-medium">{room.floor}</span>
              </div>
            </div>
            {room.roomType.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/40">
                {room.roomType.amenities.slice(0, 6).map((a) => (
                  <Badge key={a} variant="outline" className="text-[10px] py-0">
                    {a}
                  </Badge>
                ))}
                {room.roomType.amenities.length > 6 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{room.roomType.amenities.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Current booking (occupied/reserved) */}
          {currentBooking ? (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Current Booking
              </p>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {currentBooking.guest.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {currentBooking.guest.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentBooking.bookingCode} · {nights}n stay
                  </p>
                </div>
                <StatusBadge status={currentBooking.status} map={BOOKING_STATUS} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Check-In</p>
                  <p className="font-medium">{formatDate(currentBooking.checkIn)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-Out</p>
                  <p className="font-medium">{formatDate(currentBooking.checkOut)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{formatCurrency(currentBooking.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p
                    className={cn(
                      "font-medium",
                      balance > 0 ? "text-rose-600" : "text-emerald-600"
                    )}
                  >
                    {formatCurrency(balance)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Phone className="h-3 w-3" />
                <a
                  href={`tel:${currentBooking.guest.mobile}`}
                  className="hover:text-foreground"
                >
                  {currentBooking.guest.mobile}
                </a>
              </div>
            </div>
          ) : room.status === "available" ? (
            <div className="rounded-lg border border-dashed border-emerald-500/40 bg-emerald-500/5 p-3 text-center">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Room is available
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a booking to assign this room
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5"
                onClick={onNewBooking}
              >
                <Plus className="h-3.5 w-3.5" /> New Booking
              </Button>
            </div>
          ) : null}

          {/* Status change */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Change Status
            </p>
            <Select
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as RoomStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROOM_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", v.dot)} />
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dirty && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <Wrench className="h-3 w-3" />
                Will change to {ROOM_STATUS[newStatus]?.label}
                {(newStatus === "cleaning" || newStatus === "maintenance") && (
                  <span> · housekeeping task created</span>
                )}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={!dirty || pending}
            onClick={() => onUpdate(newStatus)}
            className="gap-1.5"
          >
            {pending ? "Saving…" : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
