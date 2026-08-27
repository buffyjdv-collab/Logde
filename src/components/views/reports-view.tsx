"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarCheck,
  Percent,
  ArrowDownRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { reportsApi } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import { toast } from "sonner";

type RangeKey = "7d" | "30d" | "90d" | "1y";

const CHART_COLORS = {
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  orange: "#f97316",
  zinc: "#a1a1aa",
};

const METHOD_COLOR_MAP: Record<string, string> = {
  cash: CHART_COLORS.emerald,
  upi: CHART_COLORS.sky,
  card: CHART_COLORS.violet,
  bank_transfer: CHART_COLORS.amber,
};

const CATEGORY_COLOR_ORDER = [
  CHART_COLORS.sky,
  CHART_COLORS.violet,
  CHART_COLORS.emerald,
  CHART_COLORS.orange,
  CHART_COLORS.rose,
  CHART_COLORS.amber,
  CHART_COLORS.zinc,
];

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
];

export function ReportsView() {
  const [range, setRange] = useState<RangeKey>("30d");
  const setQuickAction = useAppStore((s) => s.setQuickAction);

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", range],
    queryFn: () => reportsApi.get(range),
    refetchOnMount: true,
  });

  const handleExport = () => {
    if (!report?.dailyRevenue?.length) {
      toast.error("No daily revenue data to export");
      return;
    }
    const rows = [
      ["Date", "Revenue (INR)", "Bookings"],
      ...report.dailyRevenue.map((d) => [
        d.date,
        String(d.revenue),
        String(d.bookings),
      ]),
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
    toast.success("Report exported as CSV");
  };

  if (isLoading || !report) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Track revenue, expenses, and operational performance."
          icon={<BarChart3 className="h-5 w-5" />}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-72 animate-pulse bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  const { totals } = report;
  const netProfitPositive = totals.netProfit >= 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Performance insights for the selected range${
          range === "1y"
            ? " (last 12 months)"
            : range === "90d"
            ? " (last 90 days)"
            : range === "30d"
            ? " (last 30 days)"
            : " (last 7 days)"
        }.`}
        icon={<BarChart3 className="h-5 w-5" />}
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
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </div>
        }
      />

      {/* ── Top stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totals.totalRevenue)}
          icon={TrendingUp}
          accent="emerald"
          hint="Payments received"
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(totals.totalExpenses)}
          icon={TrendingDown}
          accent="rose"
          hint="All categories"
        />
        <StatCard
          label="Net Profit"
          value={formatCurrency(totals.netProfit)}
          icon={netProfitPositive ? TrendingUp : ArrowDownRight}
          accent={netProfitPositive ? "emerald" : "rose"}
          hint={
            netProfitPositive
              ? `+${Math.round(
                  (totals.totalRevenue > 0
                    ? totals.netProfit / totals.totalRevenue
                    : 0) * 100
                )}% margin`
              : "Operating loss"
          }
        />
        <StatCard
          label="Avg Occupancy"
          value={`${totals.avgOccupancy}%`}
          icon={Percent}
          accent="amber"
          hint="Across the range"
        />
        <StatCard
          label="Total Bookings"
          value={totals.totalBookings}
          icon={CalendarCheck}
          accent="sky"
          hint="New bookings"
        />
      </div>

      {/* ── Charts grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Revenue + Bookings */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold">Daily Revenue & Bookings</h3>
              <p className="text-xs text-muted-foreground">
                Revenue (left axis) · Bookings (right axis)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                Bookings
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={report.dailyRevenue}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(new Date(d), "dd MMM")}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                minTickGap={24}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                labelFormatter={(d) => formatDate(d)}
                formatter={(value: number, name) =>
                  name === "Revenue"
                    ? [formatCurrency(value), "Revenue"]
                    : [`${value} bookings`, "Bookings"]
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke={CHART_COLORS.emerald}
                strokeWidth={2}
                fill="url(#revArea)"
                name="Revenue"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bookings"
                stroke={CHART_COLORS.sky}
                strokeWidth={2}
                dot={false}
                name="Bookings"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Monthly Revenue vs Expenses */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Revenue vs Expenses</h3>
            <p className="text-xs text-muted-foreground">Monthly comparison</p>
          </div>
          {report.monthlyRevenue.length === 0 ? (
            <ChartEmpty label="No monthly data" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={report.monthlyRevenue} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m) => {
                    const [y, mm] = m.split("-");
                    return `${format(new Date(+y, +mm - 1, 1), "MMM yy")}`;
                  }}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Payment Methods Donut */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Payment Methods</h3>
            <p className="text-xs text-muted-foreground">Distribution by method</p>
          </div>
          {report.paymentMethodBreakdown.length === 0 ? (
            <ChartEmpty label="No payment data" />
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={report.paymentMethodBreakdown}
                    dataKey="amount"
                    nameKey="method"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {report.paymentMethodBreakdown.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={METHOD_COLOR_MAP[entry.method] || CATEGORY_COLOR_ORDER[i % CATEGORY_COLOR_ORDER.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    formatter={(v: number, _n, p) => [
                      formatCurrency(v),
                      PAYMENT_METHOD[p?.payload?.method as keyof typeof PAYMENT_METHOD]?.label || p?.payload?.method,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs w-full mt-2">
                {report.paymentMethodBreakdown.map((m) => (
                  <div key={m.method} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: METHOD_COLOR_MAP[m.method] || CHART_COLORS.zinc }}
                    />
                    <span className="text-muted-foreground truncate">
                      {PAYMENT_METHOD[m.method as keyof typeof PAYMENT_METHOD]?.label || m.method}
                    </span>
                    <span className="font-medium ml-auto">
                      {formatCurrency(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Expense Breakdown Horizontal Bar */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Expense Breakdown</h3>
            <p className="text-xs text-muted-foreground">Spending by category</p>
          </div>
          {report.expenseBreakdown.length === 0 ? (
            <ChartEmpty label="No expenses recorded" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, report.expenseBreakdown.length * 36)}>
              <BarChart
                data={report.expenseBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  width={90}
                  tickFormatter={(c) =>
                    EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES]?.label || c
                  }
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(c) =>
                    EXPENSE_CATEGORIES[c as keyof typeof EXPENSE_CATEGORIES]?.label || c
                  }
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {report.expenseBreakdown.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        EXPENSE_CATEGORIES[entry.category as keyof typeof EXPENSE_CATEGORIES]
                          ? CATEGORY_COLOR_ORDER[
                              Object.keys(EXPENSE_CATEGORIES).indexOf(entry.category) %
                                CATEGORY_COLOR_ORDER.length
                            ]
                          : CHART_COLORS.zinc
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Top Performing Rooms */}
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Top Performing Rooms</h3>
            <p className="text-xs text-muted-foreground">By revenue</p>
          </div>
          {report.topRooms.length === 0 ? (
            <ChartEmpty label="No bookings in range" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={report.topRooms} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="roomNumber"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(r) => `Rm ${r}`}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  formatter={(v: number, n) =>
                    n === "revenue" ? [formatCurrency(v), "Revenue"] : [`${v} bookings`, "Bookings"]
                  }
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" name="Bookings" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Outstanding Payments table ───────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-rose-600" />
              Outstanding Payments
            </h3>
            <p className="text-xs text-muted-foreground">
              {report.outstandingPayments.length} booking
              {report.outstandingPayments.length === 1 ? "" : "s"} with pending
              balance
            </p>
          </div>
          <Badge variant="outline" className="text-rose-600 border-rose-500/30 bg-rose-500/10">
            {formatCurrency(
              report.outstandingPayments.reduce((s, b) => s + b.balance, 0)
            )}{" "}
            total
          </Badge>
        </div>

        {report.outstandingPayments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No outstanding payments"
            description="All bookings are settled. Great work!"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outstandingPayments
                  .slice(0, 20)
                  .map((row, i) => (
                    <TableRow key={`${row.bookingCode}-${i}`}>
                      <TableCell className="font-mono text-xs">
                        {row.bookingCode}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.guestName || "—"}
                      </TableCell>
                      <TableCell>{row.roomNumber}</TableCell>
                      <TableCell className="text-right font-semibold text-rose-600 tabular-nums">
                        {formatCurrency(row.balance)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.checkOut)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuickAction("payment")}
                          className="gap-1.5"
                        >
                          <Wallet className="h-3.5 w-3.5" />
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

// ── Small internal helpers ────────────────────────────────────────

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function SkeletonToggle() {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-input bg-transparent gap-1 px-1"
      )}
    >
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
