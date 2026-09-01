"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table2,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarCheck,
  Percent,
  Receipt,
  BedDouble,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  HandCoins,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { reportsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  PAYMENT_METHOD,
  BOOKING_SOURCES,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import { toast } from "sonner";
import type { RevenueReport } from "@/lib/types";

type RangeKey = "7d" | "30d" | "90d" | "1y";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
];

const FEE_TYPE_LABEL: Record<string, string> = {
  percentage: "Percentage of Revenue",
  fixed_monthly: "Fixed Monthly",
  per_booking: "Per Booking",
};

function feeRateLabel(type: string, value: number) {
  if (type === "percentage") return `${value}% of gross revenue`;
  if (type === "fixed_monthly") return `${formatCurrency(value)} / month`;
  if (type === "per_booking") return `${formatCurrency(value)} / booking`;
  return `${value}`;
}

export function RevenueReportView() {
  const [range, setRange] = useState<RangeKey>("30d");
  const setQuickAction = useAppStore((s) => s.setQuickAction);

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "revenue", range],
    queryFn: () => reportsApi.revenue(range),
    refetchOnMount: true,
  });

  const handleExport = () => {
    if (!report?.daily?.length) {
      toast.error("No daily revenue data to export");
      return;
    }
    const rows: (string | number)[][] = [
      [
        "Date",
        "Gross Revenue",
        "Platform Fee",
        "Net Revenue",
        "Bookings",
      ],
      ...report.daily.map((d) => [
        d.date,
        d.grossRevenue,
        d.platformFee,
        d.netRevenue,
        d.bookings,
      ]),
      [
        "TOTAL",
        report.totals.grossRevenue,
        report.totals.platformFee,
        report.totals.netRevenue,
        report.totals.bookings,
      ],
    ];
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell);
            return s.includes(",") || s.includes('"')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lodgehub-revenue-${range}-${format(
      new Date(),
      "yyyy-MM-dd"
    )}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Revenue report exported");
  };

  if (isLoading || !report) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Revenue Reports"
          description="Molecular revenue breakdown including platform fees"
          icon={<Table2 className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              <SkeletonToggle />
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/40" />
          ))}
        </div>
        <Card className="h-32 animate-pulse bg-muted/40" />
        <Card className="h-72 animate-pulse bg-muted/40" />
      </div>
    );
  }

  const { totals, platformFeeSummary } = report;
  const netProfitPositive = totals.netProfit >= 0;
  const paidPct =
    platformFeeSummary.calculatedFee > 0
      ? Math.min(
          100,
          Math.round(
            (platformFeeSummary.paid / platformFeeSummary.calculatedFee) * 100
          )
        )
      : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Revenue Reports"
        description="Molecular revenue breakdown including platform fees"
        icon={<Table2 className="h-5 w-5" />}
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
                  aria-label={`Show ${opt.label} range`}
                  className="px-3"
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </div>
        }
      />

      {/* ── Top totals row (6 StatCards) ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Gross Revenue"
          value={formatCurrency(totals.grossRevenue)}
          icon={TrendingUp}
          accent="emerald"
          hint="Before platform fee"
        />
        <StatCard
          label="Platform Fee"
          value={formatCurrency(totals.platformFee)}
          icon={Percent}
          accent="rose"
          hint={`${FEE_TYPE_LABEL[platformFeeSummary.feeType] || platformFeeSummary.feeType}`}
        />
        <StatCard
          label="Net Revenue"
          value={formatCurrency(totals.netRevenue)}
          icon={CircleDollarSign}
          accent="emerald"
          hint="Gross − platform fee"
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(totals.expenses)}
          icon={TrendingDown}
          accent="amber"
          hint="All categories"
        />
        <StatCard
          label="Net Profit"
          value={formatCurrency(totals.netProfit)}
          icon={netProfitPositive ? ArrowUpRight : ArrowDownRight}
          accent={netProfitPositive ? "emerald" : "rose"}
          hint={
            netProfitPositive
              ? `${Math.round(
                  totals.netRevenue > 0
                    ? (totals.netProfit / totals.netRevenue) * 100
                    : 0
                )}% margin`
              : "Operating loss"
          }
        />
        <StatCard
          label="Total Bookings"
          value={totals.bookings}
          icon={CalendarCheck}
          accent="sky"
          hint="Created in range"
        />
      </div>

      {/* ── Platform Fee Summary card ────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600">
              <HandCoins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Platform Fee Summary</h3>
              <p className="text-xs text-muted-foreground">
                Fee policy for the period · {feeRateLabel(
                  platformFeeSummary.feeType,
                  platformFeeSummary.feeValue
                )}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border-rose-500/30 bg-rose-500/10 text-rose-600 capitalize"
            )}
          >
            {platformFeeSummary.feeType.replace("_", " ")}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <FeeSummaryStat
            label="Calculated Fee"
            value={formatCurrency(platformFeeSummary.calculatedFee)}
            accent="text-rose-600"
          />
          <FeeSummaryStat
            label="Amount Paid"
            value={formatCurrency(platformFeeSummary.paid)}
            accent="text-emerald-600"
          />
          <FeeSummaryStat
            label="Amount Pending"
            value={formatCurrency(platformFeeSummary.pending)}
            accent="text-amber-600"
          />
          <FeeSummaryStat
            label="Collection"
            value={`${paidPct}%`}
            accent="text-foreground"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Paid vs Due</span>
            <span className="font-medium">
              {formatCurrency(platformFeeSummary.paid)} /{" "}
              {formatCurrency(platformFeeSummary.calculatedFee)}
            </span>
          </div>
          <Progress
            value={paidPct}
            className="h-2.5 bg-rose-500/10"
          />
        </div>
      </Card>

      {/* ── Daily Revenue table ───────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              Daily Revenue Breakdown
            </h3>
            <p className="text-xs text-muted-foreground">
              {report.daily.length} day{report.daily.length === 1 ? "" : "s"} ·
              totals at bottom
            </p>
          </div>
        </div>

        {report.daily.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No daily data"
            description="No revenue recorded in this range."
          />
        ) : (
          <div className="max-h-96 overflow-y-auto scrollbar-thin -mx-2 px-2">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right text-rose-600">
                    Platform Fee
                  </TableHead>
                  <TableHead className="text-right text-emerald-600">
                    Net Revenue
                  </TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.daily.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="text-sm">
                      {formatDate(d.date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(d.grossRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">
                      {formatCurrency(d.platformFee)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                      {formatCurrency(d.netRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {d.bookings}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-border bg-muted/30">
                  <TableCell className="font-semibold">TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {formatCurrency(totals.grossRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-rose-600">
                    {formatCurrency(totals.platformFee)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-emerald-600">
                    {formatCurrency(totals.netRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {totals.bookings}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Revenue by Room Type table ─────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            Revenue by Room Type
          </h3>
          <p className="text-xs text-muted-foreground">
            Sorted by gross revenue (high → low)
          </p>
        </div>
        {report.byRoomType.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="No room-type data"
            description="No bookings in this range."
          />
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Type</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right text-rose-600">
                    Platform Fee
                  </TableHead>
                  <TableHead className="text-right text-emerald-600">
                    Net Revenue
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...report.byRoomType]
                  .sort((a, b) => b.grossRevenue - a.grossRevenue)
                  .map((r) => (
                    <TableRow key={r.roomType}>
                      <TableCell className="font-medium">{r.roomType}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.bookings}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(r.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600">
                        {formatCurrency(r.platformFee)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                        {formatCurrency(r.netRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Revenue by Source + Payments by Method (side-by-side on lg) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
              Revenue by Source
            </h3>
            <p className="text-xs text-muted-foreground">
              Walk-in · Online · Phone · Agent
            </p>
          </div>
          {report.bySource.length === 0 ? (
            <EmptyState
              icon={ArrowDownRight}
              title="No source data"
              description="No bookings recorded in this range."
            />
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Gross Revenue</TableHead>
                    <TableHead className="text-right text-rose-600">
                      Platform Fee
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.bySource.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="font-medium">
                        {BOOKING_SOURCES[s.source as keyof typeof BOOKING_SOURCES] ||
                          s.source}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.bookings}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(s.grossRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600">
                        {formatCurrency(s.platformFee)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Payments by Method
            </h3>
            <p className="text-xs text-muted-foreground">
              Distribution across payment channels
            </p>
          </div>
          {report.byPaymentMethod.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payment data"
              description="No payments recorded in this range."
            />
          ) : (
            <PaymentsByMethodTable rows={report.byPaymentMethod} />
          )}
        </Card>
      </div>

      {/* ── Outstanding Bookings table (the molecular part) ───────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-rose-600" />
              Outstanding Bookings
            </h3>
            <p className="text-xs text-muted-foreground">
              {report.outstandingBookings.length} booking
              {report.outstandingBookings.length === 1 ? "" : "s"} with unpaid
              balance — collect now
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-rose-600 shrink-0"
          >
            {formatCurrency(
              report.outstandingBookings.reduce((s, b) => s + b.netAmount, 0)
            )}{" "}
            net
          </Badge>
        </div>

        {report.outstandingBookings.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No outstanding bookings"
            description="All bookings are settled. Great work!"
          />
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking Code</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-In</TableHead>
                  <TableHead>Check-Out</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right text-rose-600">
                    Platform Fee
                  </TableHead>
                  <TableHead className="text-right text-emerald-600">
                    Net Amount
                  </TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outstandingBookings.map((b, i) => (
                  <TableRow key={`${b.bookingCode}-${i}`}>
                    <TableCell className="font-mono text-xs">
                      {b.bookingCode}
                    </TableCell>
                    <TableCell className="font-medium">
                      {b.guestName || "—"}
                    </TableCell>
                    <TableCell>{b.roomNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(b.checkIn)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(b.checkOut)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(b.grossAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-rose-600">
                      {formatCurrency(b.platformFee)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 font-semibold">
                      {formatCurrency(b.netAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuickAction("payment")}
                        className="gap-1.5"
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Collect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Internal helpers ────────────────────────────────────────────────

function PaymentsByMethodTable({
  rows,
}: {
  rows: RevenueReport["byPaymentMethod"];
}) {
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const pct =
              totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
            const cfg =
              PAYMENT_METHOD[r.method as keyof typeof PAYMENT_METHOD];
            return (
              <TableRow key={r.method}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        r.method === "cash" && "bg-emerald-500",
                        r.method === "upi" && "bg-sky-500",
                        r.method === "card" && "bg-violet-500",
                        r.method === "bank_transfer" && "bg-amber-500",
                        !cfg && "bg-zinc-500"
                      )}
                    />
                    {cfg?.label || r.method}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.count}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(r.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {pct.toFixed(1)}%
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-t-2 border-border bg-muted/30">
            <TableCell className="font-semibold">TOTAL</TableCell>
            <TableCell className="text-right tabular-nums font-bold">
              {totalCount}
            </TableCell>
            <TableCell className="text-right tabular-nums font-bold">
              {formatCurrency(totalAmount)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-bold">
              100%
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function FeeSummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", accent)}>
        {value}
      </p>
    </div>
  );
}

function SkeletonToggle() {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-input bg-transparent gap-1 px-1">
      {RANGE_OPTIONS.map((opt) => (
        <span
          key={opt.value}
          className="px-2.5 text-xs font-medium text-muted-foreground/60"
        >
          {opt.label}
        </span>
      ))}
    </div>
  );
}
