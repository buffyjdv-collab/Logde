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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, LogOut, Check, BedDouble, Plus, Trash2, FileText } from "lucide-react";
import { bookingsApi } from "@/lib/api";
import { formatCurrency, formatDate, PAYMENT_METHOD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Booking, Invoice } from "@/lib/types";

interface CheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtraCharge { label: string; amount: number }

const CHARGE_PRESETS = [
  { label: "Room Service", amount: 350 },
  { label: "Laundry", amount: 250 },
  { label: "Mini Bar", amount: 450 },
  { label: "Breakfast", amount: 200 },
];

export function CheckOutDialog({ open, onOpenChange }: CheckOutDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmount, setCustomAmount] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "checked_in", search],
    queryFn: () => bookingsApi.list({ status: "checked_in" }),
    enabled: open,
  });

  const filtered = bookings.filter(
    (b) =>
      !search ||
      b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
      b.bookingCode.toLowerCase().includes(search.toLowerCase()) ||
      b.room.number.includes(search)
  );

  const selected = bookings.find((b) => b.id === selectedId);

  const extraTotal = extraCharges.reduce((s, c) => s + c.amount, 0);
  const nights = selected
    ? Math.max(1, Math.round((new Date(selected.checkOut).getTime() - new Date(selected.checkIn).getTime()) / 86400000))
    : 1;
  const roomTotal = selected ? selected.tariffPerDay * nights : 0;
  const extraBedTotal = selected?.extraBed ? (selected.room.roomType.extraBedPrice * nights) : 0;
  const subtotal = roomTotal + extraBedTotal + extraTotal;
  const discount = selected?.discount || 0;
  const discountAmount = (subtotal * discount) / 100;
  const taxable = subtotal - discountAmount;
  const tax = (taxable * (selected?.taxRate || 12)) / 100;
  const grandTotal = taxable + tax;
  const balance = grandTotal - (selected?.advancePaid || 0);

  const checkOut = useMutation({
    mutationFn: () => bookingsApi.checkOut(selectedId!, { extraCharges }),
    onSuccess: (data) => {
      setInvoice(data.invoice);
      toast.success("Check-out complete. Invoice generated.");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => {
    onOpenChange(false);
    setSelectedId(null);
    setSearch("");
    setExtraCharges([]);
    setCustomLabel("");
    setCustomAmount(0);
    setInvoice(null);
  };

  if (invoice && selected) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Check className="h-5 w-5" /> Check-out Successful
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-semibold">{invoice.invoiceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guest</span>
                <span className="font-medium">{selected.guest.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room</span>
                <span className="font-medium">{selected.room.number}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-emerald-600">{formatCurrency(invoice.paidAmount)}</span>
              </div>
              {invoice.balance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-bold text-rose-600">{formatCurrency(invoice.balance)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Room {selected.room.number} has been set to <strong>Cleaning</strong>. A housekeeping task has been created.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={close}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-amber-600" />
            Check-Out Guest
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[50vh] -mx-1 px-1">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <BedDouble className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No checked-in guests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary/40 transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-sm font-semibold">
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
                          <span>Out: {formatDate(b.checkOut)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(b.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Bal: {formatCurrency(b.totalAmount - b.advancePaid)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-4">
            {/* Guest summary */}
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selected.guest.name}</p>
                  <p className="text-xs text-muted-foreground">{selected.bookingCode} · Room {selected.room.number}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                  Change
                </Button>
              </div>
            </div>

            {/* Extra charges */}
            <div>
              <Label className="mb-2 block">Add Extra Charges</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CHARGE_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setExtraCharges([...extraCharges, p])}
                  >
                    <Plus className="h-3 w-3" /> {p.label} (+{formatCurrency(p.amount)})
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Custom charge label"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={customAmount || ""}
                  onChange={(e) => setCustomAmount(+e.target.value)}
                  className="w-28"
                />
                <Button
                  variant="default"
                  onClick={() => {
                    if (customLabel && customAmount > 0) {
                      setExtraCharges([...extraCharges, { label: customLabel, amount: customAmount }]);
                      setCustomLabel("");
                      setCustomAmount(0);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {extraCharges.length > 0 && (
                <div className="space-y-1.5">
                  {extraCharges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                      <span>{c.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(c.amount)}</span>
                        <button
                          onClick={() => setExtraCharges(extraCharges.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bill summary */}
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Room ({formatCurrency(selected.tariffPerDay)} × {nights} nights)
                </span>
                <span className="font-medium">{formatCurrency(roomTotal)}</span>
              </div>
              {selected.extraBed && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra Bed</span>
                  <span className="font-medium">{formatCurrency(extraBedTotal)}</span>
                </div>
              )}
              {extraCharges.map((c, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-medium">{formatCurrency(c.amount)}</span>
                </div>
              ))}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({discount}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({selected.taxRate}%)</span>
                <span className="font-medium">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Grand Total</span>
                <span className="font-bold text-lg">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance Paid</span>
                <span className="text-emerald-600 font-medium">-{formatCurrency(selected.advancePaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Balance Due</span>
                <span className={cn("font-bold", balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {formatCurrency(Math.max(0, balance))}
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {selected && (
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => checkOut.mutate()}
            disabled={!selectedId || checkOut.isPending}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            {checkOut.isPending ? "Processing…" : "Generate Invoice & Check-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
