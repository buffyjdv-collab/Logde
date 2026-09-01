"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  PauseCircle,
  Users,
  CalendarCheck,
  IndianRupee,
  HandCoins,
  Clock,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
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
import { cn } from "@/lib/utils";
import { superDashboardApi } from "@/lib/api";
import {
  BADGE_COLOR,
  formatCurrency,
  formatDate,
} from "@/lib/constants";
import type { PlatformDashboard, PlatformFeePayment, Tenant } from "@/lib/types";

const TENANT_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  active: { label: "Active", color: "emerald" },
  suspended: { label: "Suspended", color: "rose" },
  cancelled: { label: "Cancelled", color: "zinc" },
};

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  starter: { label: "Starter", color: "zinc" },
  growth: { label: "Growth", color: "emerald" },
  scale: { label: "Scale", color: "sky" },
  enterprise: { label: "Enterprise", color: "violet" },
};

const FEE_PAYMENT_STATUS: Record<
  string,
  { label: string; color: string }
> = {
  paid: { label: "Paid", color: "emerald" },
  pending: { label: "Pending", color: "amber" },
  partial: { label: "Partial", color: "sky" },
  overdue: { label: "Overdue", color: "rose" },
};

const FEE_TYPE_LABEL: Record<string, string> = {
  percentage: "Percentage",
  fixed_monthly: "Fixed Monthly",
  per_booking: "Per Booking",
};

function feeValueLabel(
  feeType: string | undefined,
  feeValue: number | undefined
): string {
  if (!feeType || feeValue === undefined || feeValue === null) return "—";
  if (feeType === "percentage") return `${feeValue}%`;
  if (feeType === "fixed_monthly") return formatCurrency(feeValue);
  if (feeType === "per_booking") return formatCurrency(feeValue);
  return String(feeValue);
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { label: plan, color: "zinc" };
  const color = BADGE_COLOR[cfg.color] ?? BADGE_COLOR.zinc;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        color.bg,
        color.text,
        color.border
      )}
    >
      {cfg.label}
    </Badge>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse bg-muted/40" />
        ))}
      </div>
      <Card className="p-4">
        <LoadingTable rows={4} />
      </Card>
      <Card className="p-4">
        <LoadingTable rows={3} />
      </Card>
    </div>
  );
}

export function PlatformDashboardView() {
  const { data, isLoading } = useQuery<PlatformDashboard>({
    queryKey: ["super-dashboard"],
    queryFn: superDashboardApi.get,
    refetchOnMount: true,
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Cross-tenant metrics & platform health"
        icon={<ShieldCheck className="h-5 w-5" />}
      />

      {isLoading || !data ? (
        <SkeletonRow />
      ) : (
        <>
          {/* Top stats — 9 cards in rose/violet/emerald mix */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <StatCard
              label="Total Tenants"
              value={data.totalTenants}
              icon={Building2}
              accent="rose"
            />
            <StatCard
              label="Active Tenants"
              value={data.activeTenants}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              label="Suspended"
              value={data.suspendedTenants}
              icon={PauseCircle}
              accent="rose"
            />
            <StatCard
              label="Total Users"
              value={data.totalUsers}
              icon={Users}
              accent="violet"
            />
            <StatCard
              label="Total Bookings"
              value={data.totalBookings}
              icon={CalendarCheck}
              accent="emerald"
            />
            <StatCard
              label="Gross Platform Revenue"
              value={formatCurrency(data.totalGrossRevenue)}
              icon={IndianRupee}
              accent="emerald"
            />
            <StatCard
              label="Platform Fees Collected"
              value={formatCurrency(data.totalPlatformFeesCollected)}
              icon={HandCoins}
              accent="rose"
            />
            <StatCard
              label="Platform Fees Pending"
              value={formatCurrency(data.totalPlatformFeesPending)}
              icon={Clock}
              accent="amber"
            />
            <StatCard
              label="MRR"
              value={formatCurrency(data.mrr)}
              icon={TrendingUp}
              accent="violet"
              hint="Monthly Recurring Revenue"
            />
          </div>

          {/* Tenants table */}
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3 sm:px-6">
              <h3 className="text-base font-semibold">Tenants</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Per-tenant performance, fee config, and revenue summary
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto scrollbar-thin">
              {data.tenants.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No tenants yet"
                  description="Tenants will appear here once they sign up."
                />
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Gross Revenue</TableHead>
                      <TableHead className="text-right">Fees Collected</TableHead>
                      <TableHead className="text-right">Fees Pending</TableHead>
                      <TableHead>Fee Config</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tenants.map((t) => (
                      <TenantRow key={t.id} tenant={t} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          {/* Recent platform fee payments */}
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3 sm:px-6">
              <h3 className="text-base font-semibold">
                Recent Platform Fee Payments
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last 10 fee collection events across all tenants
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto scrollbar-thin">
              {data.recentFeePayments.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No fee payments yet"
                  description="Platform fee collections will appear here."
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
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentFeePayments.map((p) => (
                      <FeePaymentRow key={p.id} payment={p} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function TenantRow({
  tenant,
}: {
  tenant: Tenant & {
    userCount: number;
    bookingCount: number;
    grossRevenue: number;
    feesCollected: number;
    feesPending: number;
    platformFeeConfig:
      | {
          feeType: string;
          feeValue: number;
          active: boolean;
        }
      | null;
  };
}) {
  const collectionPct =
    tenant.feesCollected + tenant.feesPending > 0
      ? Math.min(
          100,
          Math.round(
            (tenant.feesCollected / (tenant.feesCollected + tenant.feesPending)) *
              100
          )
        )
      : 0;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-sm">{tenant.name}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {tenant.slug}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <PlanBadge plan={tenant.plan} />
      </TableCell>
      <TableCell>
        <StatusBadge status={tenant.status} map={TENANT_STATUS_MAP} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {tenant.userCount}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {tenant.bookingCount}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatCurrency(tenant.grossRevenue)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
        {formatCurrency(tenant.feesCollected)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
        {formatCurrency(tenant.feesPending)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-xs">
            <Badge
              variant="outline"
              className={cn(
                "font-medium border",
                tenant.platformFeeConfig?.active
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20"
              )}
            >
              {tenant.platformFeeConfig
                ? FEE_TYPE_LABEL[tenant.platformFeeConfig.feeType] ??
                  tenant.platformFeeConfig.feeType
                : "—"}
            </Badge>
            <span className="text-muted-foreground tabular-nums">
              {feeValueLabel(
                tenant.platformFeeConfig?.feeType,
                tenant.platformFeeConfig?.feeValue
              )}
            </span>
          </div>
          {collectionPct > 0 && (
            <Progress
              value={collectionPct}
              className="h-1 [&_[data-slot=progress-indicator]]:bg-emerald-500"
            />
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(tenant.createdAt)}
      </TableCell>
    </TableRow>
  );
}

function FeePaymentRow({
  payment,
}: {
  payment: PlatformFeePayment & { tenant: Tenant };
}) {
  const isPaid = payment.status === "paid";
  const isOverdue = payment.status === "overdue";
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <span className="font-medium text-sm">{payment.tenant.name}</span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {payment.period}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(payment.grossRevenue)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {payment.feeRate}%
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatCurrency(payment.amountDue)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums font-medium",
          isPaid
            ? "text-emerald-600 dark:text-emerald-400"
            : isOverdue
            ? "text-rose-600 dark:text-rose-400"
            : ""
        )}
      >
        {formatCurrency(payment.amountPaid)}
      </TableCell>
      <TableCell>
        <StatusBadge
          status={payment.status}
          map={FEE_PAYMENT_STATUS}
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(payment.dueDate)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {payment.paidAt ? formatDate(payment.paidAt) : "—"}
      </TableCell>
    </TableRow>
  );
}
