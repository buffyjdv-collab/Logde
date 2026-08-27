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
import { Search, CreditCard, Check } from "lucide-react";
import { bookingsApi, paymentsApi } from "@/lib/api";
import { formatCurrency, PAYMENT_METHOD, PAYMENT_TYPE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");
  const [type, setType] = useState("balance");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", "active-for-payment", search],
    queryFn: () => bookingsApi.list({}),
    enabled: open,
  });

  const filtered = bookings
    .filter((b) => ["checked_in", "confirmed", "pending"].includes(b.status))
    .filter(
      (b) =>
        !search ||
        b.guest.name.toLowerCase().includes(search.toLowerCase()) ||
        b.bookingCode.toLowerCase().includes(search.toLowerCase()) ||
        b.room.number.includes(search)
    )
    .slice(0, 30);

  const selected = bookings.find((b) => b.id === selectedId);
  const balance = selected ? selected.totalAmount - selected.advancePaid : 0;

  const submit = useMutation({
    mutationFn: () =>
      paymentsApi.create({
        bookingId: selectedId,
        guestId: selected?.guest.id,
        amount,
        method,
        type,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`Payment of ${formatCurrency(amount)} recorded`);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => {
    onOpenChange(false);
    setSelectedId(null);
    setSearch("");
    setAmount(0);
    setMethod("cash");
    setType("balance");
    setReference("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sky-600" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guest, code, or room…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="flex-1 max-h-[50vh] -mx-1 px-1">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No active bookings found
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedId(b.id);
                        setAmount(Math.max(0, b.totalAmount - b.advancePaid));
                      }}
                      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary/40 transition-all"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 text-sm font-semibold">
                        {b.guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.guest.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.bookingCode} · Room {b.room.number}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="text-sm font-semibold text-rose-600">
                          {formatCurrency(Math.max(0, b.totalAmount - b.advancePaid))}
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
            <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between">
              <div>
                <p className="font-medium">{selected.guest.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.bookingCode} · Room {selected.room.number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-bold text-rose-600">{formatCurrency(balance)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  value={amount || ""}
                  onChange={(e) => setAmount(Math.max(0, +e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TYPE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="UPI txn / card last 4"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            {amount > 0 && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recording</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(amount)} via {PAYMENT_METHOD[method as keyof typeof PAYMENT_METHOD]?.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {selected && (
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={!selectedId || amount <= 0 || submit.isPending}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            {submit.isPending ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
