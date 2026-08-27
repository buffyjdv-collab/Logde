"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, isSameMonth } from "date-fns";
import {
  Wallet,
  TrendingDown,
  Plus,
  Trash2,
  Receipt,
  Tag,
  CalendarDays,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { expensesApi } from "@/lib/api";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RangeKey = "7d" | "30d" | "90d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

// Category → hex (mirrors the BADGE_COLOR tailwind palette).
const CATEGORY_HEX: Record<string, string> = {
  emerald: "#10b981",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  orange: "#f97316",
  pink: "#ec4899",
  amber: "#f59e0b",
  zinc: "#a1a1aa",
  rose: "#f43f5e",
};

function categoryHex(category: string): string {
  const conf = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES];
  if (!conf) return "#a1a1aa";
  return CATEGORY_HEX[conf.color] ?? "#a1a1aa";
}

function CategoryBadge({ category }: { category: string }) {
  const conf = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES];
  if (!conf) {
    return (
      <Badge variant="outline" className="text-xs capitalize">
        {category}
      </Badge>
    );
  }
  const colorClass =
    conf.color === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : conf.color === "sky"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
      : conf.color === "violet"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400"
      : conf.color === "orange"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400"
      : conf.color === "pink"
      ? "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-400"
      : conf.color === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400";
  return (
    <Badge variant="outline" className={cn("text-xs gap-1", colorClass)}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: categoryHex(category) }}
      />
      {conf.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export function ExpensesView() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>("30d");
  const [category, setCategory] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const from = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return subDays(new Date(), days).toISOString();
  }, [range]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", range, category],
    queryFn: () =>
      expensesApi.list({
        from,
        category: category === "all" ? undefined : category,
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats
  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const thisMonth = expenses
      .filter((e) => isSameMonth(new Date(e.date), new Date()))
      .reduce((s, e) => s + e.amount, 0);

    const byCategory = Object.entries(EXPENSE_CATEGORIES).map(([key, conf]) => ({
      key,
      label: conf.label,
      amount: expenses
        .filter((e) => e.category === key)
        .reduce((s, e) => s + e.amount, 0),
    }));

    const top3 = [...byCategory]
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { total, thisMonth, byCategory, top3 };
  }, [expenses]);

  const chartData = useMemo(
    () =>
      stats.byCategory
        .filter((c) => c.amount > 0)
        .map((c) => ({
          ...c,
          hex: categoryHex(c.key),
        })),
    [stats]
  );

  const deleteTarget = expenses.find((e) => e.id === deleteId);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Expenses"
        description="Track operational expenses and category breakdowns."
        icon={<Wallet className="h-5 w-5" />}
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Total Expenses"
          value={formatCurrency(stats.total)}
          icon={TrendingDown}
          accent="rose"
          hint={`Last ${range}`}
        />
        <StatCard
          label="This Month"
          value={formatCurrency(stats.thisMonth)}
          icon={CalendarDays}
          accent="amber"
          hint={format(new Date(), "MMMM yyyy")}
        />
        <StatCard
          label="Top Category"
          value={stats.top3[0]?.label ?? "—"}
          icon={Tag}
          accent="violet"
          hint={
            stats.top3[0]
              ? formatCurrency(stats.top3[0].amount)
              : "No expenses yet"
          }
        />
      </div>

      {/* Top 3 categories breakdown */}
      {stats.top3.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Top Categories
          </h3>
          <div className="space-y-2.5">
            {stats.top3.map((c, idx) => {
              const pct =
                stats.total > 0
                  ? Math.round((c.amount / stats.total) * 100)
                  : 0;
              return (
                <div key={c.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums w-4">
                        {idx + 1}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: categoryHex(c.key) }}
                      />
                      <span className="font-medium">{c.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(c.amount)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: categoryHex(c.key),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pie chart */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Expense Distribution</h3>
            <p className="text-xs text-muted-foreground">
              Share by category (last {range})
            </p>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No expenses in this range
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <div className="w-full lg:w-1/2">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.hex} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full lg:w-1/2">
              {chartData
                .sort((a, b) => b.amount - a.amount)
                .map((c) => {
                  const pct =
                    stats.total > 0
                      ? Math.round((c.amount / stats.total) * 100)
                      : 0;
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-muted-foreground truncate">
                        {c.label}
                      </span>
                      <span className="ml-auto font-medium tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="hidden lg:table-cell">Method</TableHead>
                <TableHead className="hidden lg:table-cell">Recorded By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <LoadingTable rows={6} />
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={Wallet}
                      title="No expenses recorded"
                      description={`No expenses match the selected filters for the last ${range}.`}
                      action={
                        <Button
                          size="sm"
                          onClick={() => setFormOpen(true)}
                          className="gap-1.5"
                        >
                          <Plus className="h-4 w-4" /> Add Expense
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((e) => (
                  <TableRow key={e.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-sm">
                      <div className="font-medium">{formatDate(e.date)}</div>
                      <div className="text-xs text-muted-foreground md:hidden">
                        {e.description?.slice(0, 32) || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={e.category} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {e.description || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StatusBadge
                        status={e.method}
                        map={PAYMENT_METHOD}
                        withDot
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {e.user?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-rose-600">
                      {formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(e.id)}
                        className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Expense Dialog */}
      <AddExpenseDialog open={formOpen} onOpenChange={setFormOpen} />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" />
              Delete Expense?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete the expense of{" "}
                  <strong className="text-foreground">
                    {formatCurrency(deleteTarget.amount)}
                  </strong>{" "}
                  in{" "}
                  <strong className="text-foreground">
                    {EXPENSE_CATEGORIES[
                      deleteTarget.category as keyof typeof EXPENSE_CATEGORIES
                    ]?.label ?? deleteTarget.category}
                  </strong>
                  .
                </>
              ) : (
                "This will permanently delete the selected expense."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              disabled={deleteMut.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Add Expense Dialog ───────────────────────────────────────────────────

interface ExpenseFormState {
  category: string;
  amount: string;
  description: string;
  method: string;
  date: string;
}

const EMPTY_FORM: ExpenseFormState = {
  category: "utilities",
  amount: "",
  description: "",
  method: "cash",
  date: format(new Date(), "yyyy-MM-dd"),
};

function AddExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_FORM);

  const createMut = useMutation({
    mutationFn: () =>
      expensesApi.create({
        category: form.category,
        amount: Number(form.amount),
        description: form.description || undefined,
        method: form.method,
        date: new Date(form.date).toISOString(),
      }),
    onSuccess: () => {
      toast.success(
        `Expense of ${formatCurrency(Number(form.amount))} recorded`
      );
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setForm(EMPTY_FORM);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    form.category &&
    Number(form.amount) > 0 &&
    form.date;

  const set = <K extends keyof ExpenseFormState>(
    k: K,
    v: ExpenseFormState[K]
  ) => setForm({ ...form, [k]: v });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setForm(EMPTY_FORM);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Add Expense
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoryHex(k) }}
                      />
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₹
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Payment Method</Label>
            <Select value={form.method} onValueChange={(v) => set("method", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What was this expense for? (vendor, item, etc.)"
              rows={3}
            />
          </div>

          {Number(form.amount) > 0 && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recording</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(Number(form.amount))} ·{" "}
                  {
                    EXPENSE_CATEGORIES[
                      form.category as keyof typeof EXPENSE_CATEGORIES
                    ]?.label
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!valid || createMut.isPending}
            className="gap-1.5"
          >
            {createMut.isPending ? "Recording…" : "Record Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
