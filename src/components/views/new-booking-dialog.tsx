"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, UserPlus, Check } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { roomsApi, guestsApi, bookingsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { formatCurrency, BOOKING_SOURCES, ID_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import type { Room, Guest } from "@/lib/types";

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRoomId?: string;
}

export function NewBookingDialog({ open, onOpenChange, preselectedRoomId }: NewBookingDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkIn, setCheckIn] = useState<Date | undefined>(new Date());
  const [checkOut, setCheckOut] = useState<Date | undefined>(
    new Date(Date.now() + 86400000)
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBed, setExtraBed] = useState(false);
  const [source, setSource] = useState("walk_in");
  const [advance, setAdvance] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");
  const [discount, setDiscount] = useState(0);

  // New guest fields
  const [ngName, setNgName] = useState("");
  const [ngMobile, setNgMobile] = useState("");
  const [ngEmail, setNgEmail] = useState("");
  const [ngIdType, setNgIdType] = useState("aadhaar");
  const [ngIdNumber, setNgIdNumber] = useState("");
  const [ngAddress, setNgAddress] = useState("");

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", "available"],
    queryFn: () => roomsApi.list("available"),
    enabled: open,
  });

  const { data: guests = [] } = useQuery({
    queryKey: ["guests", search],
    queryFn: () => guestsApi.list(search),
    enabled: open && guestMode === "existing",
  });

  useEffect(() => {
    if (preselectedRoomId && rooms.length) {
      const r = rooms.find((x) => x.id === preselectedRoomId) || null;
      if (r) setSelectedRoom(r);
    }
  }, [preselectedRoomId, rooms]);

  const nights =
    checkIn && checkOut ? Math.max(1, differenceInCalendarDays(checkOut, checkIn)) : 1;

  const tariff = selectedRoom?.roomType.basePrice || 0;
  const extraBedCharge = extraBed ? (selectedRoom?.roomType.extraBedPrice || 0) * nights : 0;
  const subtotal = tariff * nights + extraBedCharge;
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const tax = (taxableAmount * 12) / 100;
  const total = taxableAmount + tax;

  const createGuest = useMutation({
    mutationFn: () =>
      guestsApi.create({
        name: ngName,
        mobile: ngMobile,
        email: ngEmail || undefined,
        idType: ngIdType,
        idNumber: ngIdNumber || undefined,
        address: ngAddress || undefined,
      }),
    onSuccess: (g) => {
      setSelectedGuest(g);
      setStep(2);
      toast.success(`Guest ${g.name} created`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBooking = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        guestId: selectedGuest!.id,
        roomId: selectedRoom!.id,
        checkIn: checkIn!.toISOString(),
        checkOut: checkOut!.toISOString(),
        adults,
        children,
        numGuests: adults + children,
        extraBed,
        source,
        tariffPerDay: tariff,
        advancePaid: advance,
        discount,
        taxRate: 12,
        specialRequests: specialRequests || undefined,
      }),
    onSuccess: (b) => {
      toast.success(`Booking ${b.bookingCode} created`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setStep(1);
    setSelectedGuest(null);
    setSelectedRoom(null);
    setSearch("");
    setGuestMode("existing");
    setAdults(2);
    setChildren(0);
    setExtraBed(false);
    setAdvance(0);
    setSpecialRequests("");
    setDiscount(0);
    setNgName("");
    setNgMobile("");
    setNgEmail("");
    setNgIdNumber("");
    setNgAddress("");
  };

  const canProceedStep1 =
    guestMode === "existing" ? !!selectedGuest : ngName && ngMobile;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            New Booking
            <span className="text-xs text-muted-foreground font-normal">
              Step {step} of 3
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
          {step === 1 && (
            <div className="space-y-4">
              {/* Guest mode toggle */}
              <div className="flex gap-2 rounded-lg bg-muted p-1">
                <button
                  onClick={() => setGuestMode("existing")}
                  className={cn(
                    "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                    guestMode === "existing"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Existing Guest
                </button>
                <button
                  onClick={() => setGuestMode("new")}
                  className={cn(
                    "flex-1 rounded-md py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                    guestMode === "new"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <UserPlus className="h-4 w-4" /> New Guest
                </button>
              </div>

              {guestMode === "existing" ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, mobile, or email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-1.5 rounded-lg border p-2">
                    {guests.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {search ? "No guests found" : "Type to search guests"}
                      </p>
                    ) : (
                      guests.slice(0, 8).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setSelectedGuest(g)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors",
                            selectedGuest?.id === g.id
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-muted"
                          )}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {g.mobile}
                              {g.email ? ` · ${g.email}` : ""}
                            </p>
                          </div>
                          {selectedGuest?.id === g.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input value={ngName} onChange={(e) => setNgName(e.target.value)} placeholder="Guest name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile *</Label>
                    <Input value={ngMobile} onChange={(e) => setNgMobile(e.target.value)} placeholder="10-digit mobile" maxLength={10} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={ngEmail} onChange={(e) => setNgEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ID Type</Label>
                    <Select value={ngIdType} onValueChange={setNgIdType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ID_TYPES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>ID Number</Label>
                    <Input value={ngIdNumber} onChange={(e) => setNgIdNumber(e.target.value)} placeholder="ID number" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Input value={ngAddress} onChange={(e) => setNgAddress(e.target.value)} placeholder="City, State" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Check-In Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="h-4 w-4" />
                        {checkIn ? format(checkIn, "dd MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={checkIn}
                        onSelect={(d) => {
                          setCheckIn(d);
                          if (d && checkOut && d >= checkOut) {
                            const next = new Date(d);
                            next.setDate(next.getDate() + 1);
                            setCheckOut(next);
                          }
                        }}
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>Check-Out Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="h-4 w-4" />
                        {checkOut ? format(checkOut, "dd MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={checkOut}
                        onSelect={setCheckOut}
                        disabled={(d) => !checkIn || d <= checkIn}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Select Room</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {rooms.length === 0 ? (
                    <p className="col-span-full text-center py-6 text-sm text-muted-foreground">
                      No available rooms
                    </p>
                  ) : (
                    rooms.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoom(r)}
                        className={cn(
                          "flex flex-col items-start rounded-lg border p-2.5 text-left transition-all",
                          selectedRoom?.id === r.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:border-primary/40"
                        )}
                      >
                        <span className="text-sm font-semibold">{r.number}</span>
                        <span className="text-xs text-muted-foreground">{r.roomType.name}</span>
                        <span className="text-xs font-medium text-primary mt-0.5">
                          {formatCurrency(r.roomType.basePrice)}/night
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Adults</Label>
                  <Input type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, +e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Children</Label>
                  <Input type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, +e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Extra Bed</Label>
                  <Button
                    type="button"
                    variant={extraBed ? "default" : "outline"}
                    className="w-full"
                    onClick={() => setExtraBed(!extraBed)}
                  >
                    {extraBed ? "Yes" : "No"}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Booking Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BOOKING_SOURCES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Special Requests</Label>
                <Textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requests from the guest…"
                  rows={2}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Guest</span>
                  <span className="text-sm font-medium">{selectedGuest?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Room</span>
                  <span className="text-sm font-medium">
                    {selectedRoom?.number} · {selectedRoom?.roomType.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Dates</span>
                  <span className="text-sm font-medium">
                    {checkIn && format(checkIn, "dd MMM")} → {checkOut && format(checkOut, "dd MMM")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nights</span>
                  <span className="text-sm font-medium">{nights}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Guests</span>
                  <span className="text-sm font-medium">{adults} adults, {children} children</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room ({formatCurrency(tariff)} × {nights})</span>
                  <span className="font-medium">{formatCurrency(tariff * nights)}</span>
                </div>
                {extraBed && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Extra Bed</span>
                    <span className="font-medium">{formatCurrency(extraBedCharge)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount (%)</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Math.min(100, +e.target.value)))}
                    className="w-20 h-8 text-right"
                  />
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount Applied</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (12% GST)</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Advance Payment</Label>
                <Input
                  type="number"
                  min={0}
                  value={advance}
                  onChange={(e) => setAdvance(Math.max(0, +e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Balance at check-out: {formatCurrency(Math.max(0, total - advance))}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step === 1 && guestMode === "existing" && (
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Continue
            </Button>
          )}
          {step === 1 && guestMode === "new" && (
            <Button
              onClick={() => createGuest.mutate()}
              disabled={!canProceedStep1 || createGuest.isPending}
            >
              {createGuest.isPending ? "Creating…" : "Create & Continue"}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!selectedRoom || !checkIn || !checkOut}>
              Review
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={() => createBooking.mutate()}
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Creating…" : "Confirm Booking"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
