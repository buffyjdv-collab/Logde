"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, isToday } from "date-fns";
import {
  ReceiptIndianRupee,
  Wallet,
  TrendingUp,
  Banknote,
  Smartphone,
  CreditCard,
  Landmark,
  Printer,
  Eye,
  FileText,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { paymentsApi, bookingsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  BOOKING_STATUS,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Payment, Booking, InvoiceItem } from "@/lib/types";

type RangeKey = "7d" | "30d" | "90d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

const METHOD_HEX: Record<string, string> = {
  cash: "#10b981",
  upi: "#0ea5e9",
  card: "#8b5cf6",
  bank_transfer: "#f59e0b",
};

const METHOD_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  upi: Smartphone,
  card: CreditCard,
  bank_transfer: Landmark,
};

// ─────────────────────────────────────────────────────────────────────────

export function PaymentsView() {
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const [range, setRange] = useState<RangeKey>("30d");

  const from = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return subDays(new Date(), days).toISOString();
  }, [range]);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments", range],
    queryFn: () => paymentsApi.list({ from }),
  });

  // We also need bookings to map payment.bookingId → bookingCode/guest.
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", "for-payments"],
    queryFn: () => bookingsApi.list({}),
  });

  const { data: checkedOut = [] } = useQuery({
    queryKey: ["bookings", "checked_out"],
    queryFn: () => bookingsApi.list({ status: "checked_out" }),
  });

  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>();
    bookings.forEach((b) => m.set(b.id, b));
    return m;
  }, [bookings]);

  // Stats
  const stats = useMemo(() => {
    const today = payments
      .filter((p) => isToday(new Date(p.createdAt)))
      .reduce((s, p) => s + p.amount, 0);
    const total = payments.reduce((s, p) => s + p.amount, 0);

    const byMethod = (Object.keys(PAYMENT_METHOD) as Array<keyof typeof PAYMENT_METHOD>).map(
      (m) => ({
        method: m,
        label: PAYMENT_METHOD[m].label,
        amount: payments
          .filter((p) => p.method === m)
          .reduce((s, p) => s + p.amount, 0),
        count: payments.filter((p) => p.method === m).length,
      })
    );

    const outstanding = checkedOut.reduce(
      (s, b) => s + Math.max(0, computeInvoice(b).balance),
      0
    );

    return { today, total, byMethod, outstanding };
  }, [payments, checkedOut]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Payments"
        description="Track collections, invoices, and outstanding balances."
        icon={<ReceiptIndianRupee className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(v) => v && setRange(v as RangeKey)}
              variant="outline"
              size="sm"
            >
              {RANGE_OPTIONS.map((opt) => (
                <ToggleGroupItem
                  key={opt.value}
                  value={opt.value}
                  aria-label={`Last ${opt.label}`}
                  className="px-3"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              size="sm"
              onClick={() => setQuickAction("payment")}
              className="gap-1.5"
            >
              <ReceiptIndianRupee className="h-4 w-4" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Record</span>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Collected"
          value={formatCurrency(stats.total)}
          icon={TrendingUp}
          accent="emerald"
          hint={`Last ${range}`}
        />
        <StatCard
          label="Today's Collection"
          value={formatCurrency(stats.today)}
          icon={Wallet}
          accent="sky"
          hint={format(new Date(), "dd MMM yyyy")}
        />
        <StatCard
          label="Cash + UPI"
          value={formatCurrency(
            stats.byMethod
              .filter((m) => m.method === "cash" || m.method === "upi")
              .reduce((s, m) => s + m.amount, 0)
          )}
          icon={Banknote}
          accent="violet"
          hint={`${stats.byMethod
            .filter((m) => m.method === "cash" || m.method === "upi")
            .reduce((s, m) => s + m.count, 0)} txns`}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          icon={Wallet}
          accent="rose"
          hint={`${checkedOut.length} invoices`}
        />
      </div>

      {/* Method breakdown bar chart */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Collections by Method</h3>
            <p className="text-xs text-muted-foreground">
              Distribution across payment methods
            </p>
          </div>
        </div>
        {payments.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No payments in this range
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.byMethod} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {stats.byMethod.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={METHOD_HEX[entry.method] || "#a1a1aa"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Legend with amounts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {stats.byMethod.map((m) => {
            const Icon = METHOD_ICON[m.method] ?? Banknote;
            return (
              <div
                key={m.method}
                className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: METHOD_HEX[m.method] || "#a1a1aa" }}
                />
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m.label}
                  </p>
                  <p className="text-xs font-semibold tabular-nums">
                    {formatCurrency(m.amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {checkedOut.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-3">
          <TransactionsTab
            payments={payments}
            bookingMap={bookingMap}
            loading={paymentsLoading}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-3">
          <InvoicesTab bookings={checkedOut} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Transactions tab ─────────────────────────────────────────────────────

function TransactionsTab({
  payments,
  bookingMap,
  loading,
}: {
  payments: Payment[];
  bookingMap: Map<string, Booking>;
  loading: boolean;
}) {
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      payments.filter(
        (p) =>
          (methodFilter === "all" || p.method === methodFilter) &&
          (typeFilter === "all" || p.type === typeFilter)
      ),
    [payments, methodFilter, typeFilter]
  );

  return (
    <Card className="p-0 overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30">
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(PAYMENT_TYPE).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">
          {filtered.length} of {payments.length}
        </Badge>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead className="hidden md:table-cell">Booking</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="hidden lg:table-cell">Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <LoadingTable rows={6} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={ReceiptIndianRupee}
                    title="No transactions"
                    description="No payments match the selected filters or date range."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const booking = p.bookingId
                  ? bookingMap.get(p.bookingId)
                  : null;
                return (
                  <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {format(new Date(p.createdAt), "dd MMM")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(p.createdAt), "hh:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold shrink-0">
                          {(p.guest?.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.guest?.name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {booking?.bookingCode ?? "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">
                      {booking?.bookingCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {PAYMENT_TYPE[p.type as keyof typeof PAYMENT_TYPE] ?? p.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={p.method}
                        map={PAYMENT_METHOD}
                        withDot
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {p.reference || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(p.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ── Invoices tab ─────────────────────────────────────────────────────────

interface ClientInvoice {
  booking: Booking;
  invoiceCode: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "unpaid";
  createdAt: string;
}

function computeInvoice(booking: Booking): ClientInvoice {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkOut).getTime() -
        new Date(booking.checkIn).getTime()) /
        86400000
    )
  );
  const items: InvoiceItem[] = [];
  const roomCharge = booking.tariffPerDay * nights;
  items.push({
    label: `Room (${booking.room.roomType.name})`,
    qty: nights,
    rate: booking.tariffPerDay,
    amount: roomCharge,
  });
  if (booking.extraBed) {
    const eb = booking.room.roomType.extraBedPrice || 0;
    items.push({
      label: "Extra Bed",
      qty: nights,
      rate: eb,
      amount: eb * nights,
    });
  }
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = Math.round(subtotal * (booking.taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount - booking.discount;
  const paid = booking.advancePaid;
  const balance = Math.max(0, total - paid);
  const status: ClientInvoice["status"] =
    balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  const invoiceCode = `INV-${booking.bookingCode.replace(/\D/g, "").padStart(4, "0")}`;
  return {
    booking,
    invoiceCode,
    items,
    subtotal,
    tax: taxAmount,
    discount: booking.discount,
    total,
    paid,
    balance,
    status,
    createdAt: booking.checkOutActual ?? booking.checkOut,
  };
}

function InvoicesTab({ bookings }: { bookings: Booking[] }) {
  const [selected, setSelected] = useState<ClientInvoice | null>(null);

  return (
    <div className="space-y-3">
      {bookings.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices are generated automatically when a guest checks out."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map((b) => {
            const inv = computeInvoice(b);
            return (
              <Card
                key={b.id}
                className="p-4 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {inv.invoiceCode}
                    </p>
                    <p className="text-sm font-semibold mt-0.5">
                      {b.guest.name}
                    </p>
                  </div>
                  <InvoiceStatusBadge status={inv.status} />
                </div>

                <div className="text-xs text-muted-foreground space-y-1 mb-3">
                  <div className="flex items-center justify-between">
                    <span>Room</span>
                    <span className="font-medium text-foreground">
                      {b.room.number} · {b.room.roomType.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Check-in</span>
                    <span className="font-medium text-foreground">
                      {formatDate(b.checkIn)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Check-out</span>
                    <span className="font-medium text-foreground">
                      {formatDate(b.checkOut)}
                    </span>
                  </div>
                </div>

                <div className="mt-auto space-y-1 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(inv.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-medium tabular-nums text-emerald-600">
                      {formatCurrency(inv.paid)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        inv.balance > 0 ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {formatCurrency(inv.balance)}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  onClick={() => setSelected(inv)}
                >
                  <Eye className="h-4 w-4" />
                  View Invoice
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <InvoiceDialog
        invoice={selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: ClientInvoice["status"] }) {
  const map = {
    paid: {
      label: "Paid",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    partial: {
      label: "Partial",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    unpaid: {
      label: "Unpaid",
      className:
        "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    },
  };
  const c = map[status];
  return (
    <Badge variant="outline" className={cn("text-xs", c.className)}>
      {c.label}
    </Badge>
  );
}

// ── Printable invoice dialog ─────────────────────────────────────────────

function InvoiceDialog({
  invoice,
  onOpenChange,
}: {
  invoice: ClientInvoice | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Invoice {invoice?.invoiceCode ?? ""}
          </DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
            <div className="rounded-lg border p-4 space-y-4 print:shadow-none print:border-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b">
                <div>
                  <p className="text-base font-bold">Pine Valley Lodge</p>
                  <p className="text-xs text-muted-foreground">
                    Invoice: <span className="font-mono">{invoice.invoiceCode}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Booking: <span className="font-mono">{invoice.booking.bookingCode}</span>
                  </p>
                </div>
                <div className="text-right">
                  <InvoiceStatusBadge status={invoice.status} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(invoice.createdAt)}
                  </p>
                </div>
              </div>

              {/* Guest + room info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Billed To</p>
                  <p className="font-medium">{invoice.booking.guest.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.booking.guest.mobile}
                  </p>
                  {invoice.booking.guest.company && (
                    <p className="text-xs text-muted-foreground">
                      {invoice.booking.guest.company}
                      {invoice.booking.guest.gstNumber
                        ? ` · GSTIN ${invoice.booking.guest.gstNumber}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-muted-foreground mb-1">Stay</p>
                  <p className="text-sm font-medium">
                    Room {invoice.booking.room.number} ·{" "}
                    {invoice.booking.room.roomType.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.booking.checkIn)} →{" "}
                    {formatDate(invoice.booking.checkOut)}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{item.label}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {item.qty}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatCurrency(item.rate)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="ml-auto w-full sm:w-72 space-y-1.5 text-sm pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="tabular-nums">
                      -{formatCurrency(invoice.discount)}
                    </span>
                  </div>
                )}
                {invoice.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tax ({invoice.booking.taxRate}%)
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(invoice.tax)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Paid</span>
                  <span className="tabular-nums">
                    {formatCurrency(invoice.paid)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="font-semibold">Balance Due</span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      invoice.balance > 0 ? "text-rose-600" : "text-emerald-600"
                    )}
                  >
                    {formatCurrency(invoice.balance)}
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground pt-3 border-t">
                Thank you for staying with us · This is a computer-generated
                invoice and does not require a signature.
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            onClick={() => window.print()}
            className="gap-1.5"
            disabled={!invoice}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
