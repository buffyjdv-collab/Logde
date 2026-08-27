"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, LogIn, Check, User, BedDouble } from "lucide-react";
import { bookingsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Booking } from "@/lib/types";

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInDialog({ open, onOpenChange }: CheckInDialogProps) {
  const queryClient = useQueryClient();
  const setView = useAppStore((s) => s.setView);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "confirmed", search],
    queryFn: () => bookingsApi.list({ status: "confirmed" }),
    enabled: open,
  });

  const filtered = bookings.filter(
    (b) =>
      !search ||
      b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
      b.bookingCode.toLowerCase().includes(search.toLowerCase()) ||
      b.guest.mobile.includes(search)
  );

  const checkIn = useMutation({
    mutationFn: (id: string) => bookingsApi.checkIn(id),
    onSuccess: (b) => {
      toast.success(`${b.guest.name} checked in to Room ${b.room.number}`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      onOpenChange(false);
      setSelectedId(null);
      setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-emerald-600" />
            Check-In Guest
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 max-h-[50vh] -mx-1 px-1">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading confirmed bookings…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No confirmed bookings to check in
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  onOpenChange(false);
                  useAppStore.getState().setQuickAction("new_booking");
                }}
              >
                Create a booking
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selectedId === b.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "hover:border-primary/40"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-semibold">
                    {b.guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{b.guest.name}</p>
                      <span className="text-xs text-muted-foreground">{b.bookingCode}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3 w-3" /> Room {b.room.number}
                      </span>
                      <span>{formatDate(b.checkIn)} → {formatDate(b.checkOut)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(b.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Adv: {formatCurrency(b.advancePaid)}
                    </p>
                  </div>
                  {selectedId === b.id && (
                    <Check className="h-5 w-5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedId && checkIn.mutate(selectedId)}
            disabled={!selectedId || checkIn.isPending}
          >
            {checkIn.isPending ? "Checking in…" : "Confirm Check-In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
