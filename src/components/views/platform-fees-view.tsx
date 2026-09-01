"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Percent,
  HandCoins,
  Clock,
  AlertTriangle,
  CalendarClock,
  Pencil,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { platformFeesApi } from "@/lib/api";
import { BADGE_COLOR, formatCurrency, formatDate } from "@/lib/constants";
import type {
  PlatformFeeConfig,
  PlatformFeePayment,
  Tenant,
} from "@/lib/types";

type FeeConfigRow = PlatformFeeConfig & { tenant: Tenant };
type FeePaymentRow = PlatformFeePayment & { tenant: Tenant };

const FEE_PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: "Paid", color: "emerald" },
  pending: { label: "Pending", color: "amber" },
  partial: { label: "Partial", color: "sky" },
  overdue: { label: "Overdue", color: "rose" },
};

const FEE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  percentage: { label: "Percentage", color: "violet" },
  fixed_monthly: { label: "Fixed Monthly", color: "sky" },
  per_booking: { label: "Per Booking", color: "emerald" },
};

const FEE_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (% of revenue)" },
  { value: "fixed_monthly", label: "Fixed Monthly (₹/month)" },
  { value: "per_booking", label: "Per Booking (₹/booking)" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer (NEFT/IMPS)" },
  { value: "card", label: "Card" },
];

function FeeTypeBadge({ type }: { type: string }) {
  const cfg = FEE_TYPE_BADGE[type] ?? { label: type, color: "zinc" };
  const color = BADGE_COLOR[cfg.color] ?? BADGE_COLOR.zinc;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium border", color.bg, color.text, color.border)}
    >
      {cfg.label}
    </Badge>
  );
}

function feeValueLabel(type: string, value: number): string {
  if (type === "percentage") return `${value}%`;
  if (type === "fixed_monthly") return formatCurrency(value) + "/mo";
  if (type === "per_booking") return formatCurrency(value) + "/booking";
  return String(value);
}

export function PlatformFeesView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("configs");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [editingConfig, setEditingConfig] = useState<FeeConfigRow | null>(null);
  const [recordingPayment, setRecordingPayment] =
    useState<FeePaymentRow | null>(null);

  const { data: configs = [], isLoading: configsLoading } = useQuery<
    FeeConfigRow[]
  >({
    queryKey: ["platform-fee-configs"],
    queryFn: platformFeesApi.configs,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<
    FeePaymentRow[]
  >({
    queryKey: ["platform-fee-payments"],
    queryFn: platformFeesApi.payments,
  });

  const filteredPayments = useMemo(() => {
    if (paymentStatusFilter === "all") return payments;
    return payments.filter((p) => p.status === paymentStatusFilter);
  }, [payments, paymentStatusFilter]);

  const stats = useMemo(() => {
    const totalCollected = payments
      .filter((p) => p.status === "paid" || p.status === "partial")
      .reduce((sum, p) => sum + p.amountPaid, 0);
    const totalPending = payments
      .filter((p) => p.status !== "paid")
      .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);
    const overdueCount = payments.filter((p) => p.status === "overdue").length;
    const now = new Date();
    const thisMonth = payments
      .filter((p) => {
        if (!p.paidAt) return false;
        const d = new Date(p.paidAt);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, p) => sum + p.amountPaid, 0);
    return { totalCollected, totalPending, overdueCount, thisMonth };
  }, [payments]);

  const updateConfigMutation = useMutation({
    mutationFn: ({
      tenantId,
      data,
    }: {
      tenantId: string;
      data: {
        feeType?: string;
        feeValue?: number;
        active?: boolean;
        notes?: string;
      };
    }) => platformFeesApi.updateConfig(tenantId, data),
    onSuccess: () => {
      toast.success("Fee configuration updated");
      queryClient.invalidateQueries({ queryKey: ["platform-fee-configs"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      setEditingConfig(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { amount: number; method: string; reference?: string };
    }) => platformFeesApi.recordPayment(id, data),
    onSuccess: (res) => {
      toast.success(
        res.status === "paid"
          ? "Payment recorded — fee marked as paid"
          : "Partial payment recorded"
      );
      queryClient.invalidateQueries({ queryKey: ["platform-fee-payments"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      setRecordingPayment(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Platform Fees"
        description="Configure fee policy per tenant & collect payments"
        icon={<Percent className="h-5 w-5" />}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Collected (all time)"
          value={formatCurrency(stats.totalCollected)}
          icon={HandCoins}
          accent="rose"
        />
        <StatCard
          label="Total Pending"
          value={formatCurrency(stats.totalPending)}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          label="Overdue Count"
          value={stats.overdueCount}
          icon={AlertTriangle}
          accent="rose"
        />
        <StatCard
          label="This Month Collected"
          value={formatCurrency(stats.thisMonth)}
          icon={CalendarClock}
          accent="emerald"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="configs">Fee Configurations</TabsTrigger>
          <TabsTrigger value="payments">Fee Payments</TabsTrigger>
        </TabsList>

        {/* ── Fee Configurations tab ─────────────────────────────────── */}
        <TabsContent value="configs" className="mt-4">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3 sm:px-6">
              <h3 className="text-base font-semibold">Fee Configurations</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Per-tenant fee policy — type, value, and active state
              </p>
            </div>
            <div className="max-h-[65vh] overflow-auto scrollbar-thin">
              {configsLoading ? (
                <div className="p-4">
                  <LoadingTable rows={5} />
                </div>
              ) : configs.length === 0 ? (
                <EmptyState
                  icon={Percent}
                  title="No fee configurations"
                  description="Fee configurations appear here once tenants are created."
                />
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead>Fee Value</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {c.tenant.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {c.tenant.slug}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <FeeTypeBadge type={c.feeType} />
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {feeValueLabel(c.feeType, c.feeValue)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={c.active}
                              disabled
                              aria-label="Fee config active"
                            />
                            <span
                              className={cn(
                                "text-xs",
                                c.active
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {c.active ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                          {c.notes ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(c.tenant.createdAt, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingConfig(c)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Fee Payments tab ───────────────────────────────────────── */}
        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
            <Select
              value={paymentStatusFilter}
              onValueChange={setPaymentStatusFilter}
            >
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3 sm:px-6">
              <h3 className="text-base font-semibold">Fee Payments</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                All platform fee collection events across tenants
              </p>
            </div>
            <div className="max-h-[65vh] overflow-auto scrollbar-thin">
              {paymentsLoading ? (
                <div className="p-4">
                  <LoadingTable rows={5} />
                </div>
              ) : filteredPayments.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No fee payments found"
                  description="Fee payment records will appear here as tenants are billed."
                />
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Gross Revenue</TableHead>
                      <TableHead className="text-right">Fee Rate</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const balance = p.amountDue - p.amountPaid;
                      const canRecord = p.status !== "paid";
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/50">
                          <TableCell>
                            <span className="font-medium text-sm">
                              {p.tenant.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {p.period}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(p.grossRevenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {p.feeRate}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(p.amountDue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatCurrency(p.amountPaid)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                            {formatCurrency(balance)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={p.status}
                              map={FEE_PAYMENT_STATUS}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(p.dueDate)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {p.paidAt ? formatDate(p.paidAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {canRecord ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRecordingPayment(p)}
                              >
                                <Wallet className="h-3.5 w-3.5 mr-1" /> Record
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit fee config dialog */}
      <EditFeeConfigDialog
        config={editingConfig}
        onClose={() => setEditingConfig(null)}
        onSubmit={(data) => {
          if (editingConfig) {
            updateConfigMutation.mutate({
              tenantId: editingConfig.tenantId,
              data,
            });
          }
        }}
        saving={updateConfigMutation.isPending}
      />

      {/* Record payment dialog */}
      <RecordPaymentDialog
        payment={recordingPayment}
        onClose={() => setRecordingPayment(null)}
        onSubmit={(data) => {
          if (recordingPayment) {
            recordPaymentMutation.mutate({ id: recordingPayment.id, data });
          }
        }}
        saving={recordPaymentMutation.isPending}
      />
    </div>
  );
}

interface EditFeeConfigData {
  feeType: string;
  feeValue: number;
  active: boolean;
  notes: string;
}

function EditFeeConfigDialog({
  config,
  onClose,
  onSubmit,
  saving,
}: {
  config: FeeConfigRow | null;
  onClose: () => void;
  onSubmit: (data: EditFeeConfigData) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={!!config} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Fee Configuration</DialogTitle>
          <DialogDescription>
            {config
              ? `Update fee policy for ${config.tenant.name}.`
              : "Update fee policy."}
          </DialogDescription>
        </DialogHeader>
        {config && (
          <EditFeeConfigForm
            key={config.id}
            config={config}
            onClose={onClose}
            onSubmit={onSubmit}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditFeeConfigForm({
  config,
  onClose,
  onSubmit,
  saving,
}: {
  config: FeeConfigRow;
  onClose: () => void;
  onSubmit: (data: EditFeeConfigData) => void;
  saving: boolean;
}) {
  const [feeType, setFeeType] = useState<string>(config.feeType);
  const [feeValue, setFeeValue] = useState<string>(String(config.feeValue));
  const [active, setActive] = useState<boolean>(config.active);
  const [notes, setNotes] = useState<string>(config.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(feeValue);
    if (Number.isNaN(val) || val < 0) {
      toast.error("Fee value must be a non-negative number");
      return;
    }
    onSubmit({
      feeType,
      feeValue: val,
      active,
      notes: notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fc-type">Fee Type</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger id="fc-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-value">
              Fee Value{" "}
              <span className="text-muted-foreground text-xs">
                ({feeType === "percentage" ? "%" : "₹"})
              </span>
            </Label>
            <Input
              id="fc-value"
              type="number"
              min="0"
              step={feeType === "percentage" ? "0.5" : "100"}
              value={feeValue}
              onChange={(e) => setFeeValue(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="fc-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Disable to pause fee accrual for this tenant.
              </p>
            </div>
            <Switch
              id="fc-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-notes">Notes</Label>
            <Textarea
              id="fc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for the finance team…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Configuration"}
            </Button>
          </DialogFooter>
    </form>
  );
}

interface RecordPaymentData {
  amount: number;
  method: string;
  reference?: string;
}

function RecordPaymentDialog({
  payment,
  onClose,
  onSubmit,
  saving,
}: {
  payment: FeePaymentRow | null;
  onClose: () => void;
  onSubmit: (data: RecordPaymentData) => void;
  saving: boolean;
}) {
  const balance =
    payment && payment.amountDue > payment.amountPaid
      ? payment.amountDue - payment.amountPaid
      : 0;
  return (
    <Dialog open={!!payment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Platform Fee Payment</DialogTitle>
          <DialogDescription>
            {payment
              ? `Recording payment for ${payment.tenant.name} — period ${payment.period}.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {payment && (
          <RecordPaymentForm
            key={payment.id}
            payment={payment}
            balance={balance}
            onClose={onClose}
            onSubmit={onSubmit}
            saving={saving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({
  payment,
  balance,
  onClose,
  onSubmit,
  saving,
}: {
  payment: FeePaymentRow;
  balance: number;
  onClose: () => void;
  onSubmit: (data: RecordPaymentData) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState<string>(String(balance));
  const [method, setMethod] = useState<string>("upi");
  const [reference, setReference] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (Number.isNaN(val) || val <= 0) {
      toast.error("Enter a valid positive amount");
      return;
    }
    if (val > balance) {
      toast.error(
        `Amount cannot exceed balance (${formatCurrency(balance)})`
      );
      return;
    }
    onSubmit({
      amount: val,
      method,
      reference: reference.trim() || undefined,
    });
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Amount Due" value={formatCurrency(payment.amountDue)} />
        <Stat
          label="Amount Paid"
          value={formatCurrency(payment.amountPaid)}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label="Balance"
          value={formatCurrency(balance)}
          accent="text-rose-600 dark:text-rose-400"
        />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rp-amount">Amount (₹)</Label>
          <Input
            id="rp-amount"
            type="number"
            min="1"
            max={balance}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Prefilled with the outstanding balance.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp-method">Payment Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="rp-method" className="w-full">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp-ref">Reference (UTR / Cheque no.)</Label>
          <Input
            id="rp-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || balance <= 0}>
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ?? "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
