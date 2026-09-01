"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  Check,
  Building2,
  Sparkles,
  Rocket,
  Plane,
  Star,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
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
import { cn } from "@/lib/utils";
import { tenantsApi } from "@/lib/api";
import { BADGE_COLOR, formatCurrency, formatDate } from "@/lib/constants";
import type { Tenant } from "@/lib/types";

interface PlanDef {
  key: string;
  name: string;
  price: number;
  interval: string;
  maxRooms: number;
  maxUsers: number;
  features: string[];
  color: "zinc" | "emerald" | "sky" | "violet";
  icon: typeof Sparkles;
}

const PLANS: PlanDef[] = [
  {
    key: "starter",
    name: "Starter",
    price: 999,
    interval: "month",
    maxRooms: 10,
    maxUsers: 3,
    features: [
      "Up to 10 rooms",
      "3 staff users",
      "Front desk & bookings",
      "Basic reporting",
      "Email support",
    ],
    color: "zinc",
    icon: Sparkles,
  },
  {
    key: "growth",
    name: "Growth",
    price: 2499,
    interval: "month",
    maxRooms: 50,
    maxUsers: 10,
    features: [
      "Up to 50 rooms",
      "10 staff users",
      "Housekeeping module",
      "Guest history & IDs",
      "Expense tracking",
      "Priority email support",
    ],
    color: "emerald",
    icon: Rocket,
  },
  {
    key: "scale",
    name: "Scale",
    price: 4999,
    interval: "month",
    maxRooms: 200,
    maxUsers: 25,
    features: [
      "Up to 200 rooms",
      "25 staff users",
      "Multi-property support",
      "Advanced reports & GST",
      "Role-based permissions",
      "Phone & email support",
    ],
    color: "sky",
    icon: Plane,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 9999,
    interval: "month",
    maxRooms: 1000,
    maxUsers: 100,
    features: [
      "Up to 1000 rooms",
      "100 staff users",
      "Unlimited properties",
      "Custom integrations",
      "Dedicated success manager",
      "24×7 priority support",
    ],
    color: "violet",
    icon: Crown,
  },
];

const TENANT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "emerald" },
  suspended: { label: "Suspended", color: "rose" },
  cancelled: { label: "Cancelled", color: "zinc" },
};

const PLAN_TOP_BAR: Record<PlanDef["color"], string> = {
  zinc: "bg-zinc-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

function PlanCard({
  plan,
  count,
}: {
  plan: PlanDef;
  count: number;
}) {
  const color = BADGE_COLOR[plan.color];
  const Icon = plan.icon;
  return (
    <Card className="relative overflow-hidden p-5 flex flex-col">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          PLAN_TOP_BAR[plan.color]
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "rounded-lg p-2 ring-1",
              color.bg,
              color.text,
              color.border
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{plan.name}</h3>
            <p className="text-xs text-muted-foreground">
              {count} {count === 1 ? "tenant" : "tenants"}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("font-medium border", color.bg, color.text, color.border)}
        >
          {plan.maxRooms} rooms
        </Badge>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">
          {formatCurrency(plan.price)}
        </span>
        <span className="text-sm text-muted-foreground">/{plan.interval}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-muted-foreground">Max Rooms</p>
          <p className="font-semibold text-sm">{plan.maxRooms}</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-muted-foreground">Max Users</p>
          <p className="font-semibold text-sm">{plan.maxUsers}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check
              className={cn("h-4 w-4 mt-0.5 shrink-0", color.text)}
            />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlatformPlansView() {
  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: tenantsApi.list,
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tenants) {
      map[t.plan] = (map[t.plan] ?? 0) + 1;
    }
    return map;
  }, [tenants]);

  const totalTenants = tenants.length;
  const totalMRR = useMemo(() => {
    return tenants.reduce((sum, t) => {
      const plan = PLANS.find((p) => p.key === t.plan);
      return sum + (plan?.price ?? 0);
    }, 0);
  }, [tenants]);

  const mostPopular = useMemo(() => {
    let best: { key: string; count: number } | null = null;
    for (const p of PLANS) {
      const c = counts[p.key] ?? 0;
      if (!best || c > best.count) {
        best = { key: p.key, count: c };
      }
    }
    return best;
  }, [counts]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Subscription Plans"
        description="Platform pricing tiers and tenant subscriptions"
        icon={<Crown className="h-5 w-5" />}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Tenants"
          value={totalTenants}
          icon={Building2}
          accent="rose"
        />
        <StatCard
          label="Total MRR"
          value={formatCurrency(totalMRR)}
          icon={Star}
          accent="emerald"
          hint="Sum of active subscriptions"
        />
        <StatCard
          label="Plans Available"
          value={PLANS.length}
          icon={Crown}
          accent="violet"
        />
        <StatCard
          label="Most Popular"
          value={
            mostPopular && mostPopular.count > 0
              ? PLANS.find((p) => p.key === mostPopular.key)?.name ?? "—"
              : "—"
          }
          icon={Sparkles}
          accent="sky"
          hint={
            mostPopular && mostPopular.count > 0
              ? `${mostPopular.count} tenants`
              : ""
          }
        />
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            count={counts[plan.key] ?? 0}
          />
        ))}
      </div>

      {/* Tenant subscriptions table */}
      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 sm:px-6">
          <h3 className="text-base font-semibold">Tenant Subscriptions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Current plan and status for every tenant on the platform
          </p>
        </div>
        <div className="max-h-[60vh] overflow-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4">
              <LoadingTable rows={5} />
            </div>
          ) : tenants.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tenants yet"
              description="Once tenants sign up, their subscription details will appear here."
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Renewal Cycle</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const plan = PLANS.find((p) => p.key === t.plan);
                  const planColor = plan
                    ? BADGE_COLOR[plan.color]
                    : BADGE_COLOR.zinc;
                  return (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{t.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {t.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium border capitalize",
                            planColor.bg,
                            planColor.text,
                            planColor.border
                          )}
                        >
                          {plan?.name ?? t.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={t.status}
                          map={TENANT_STATUS_MAP}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Monthly (auto-renew)
                      </TableCell>
                      <TableCell className="text-sm font-medium tabular-nums">
                        {plan ? formatCurrency(plan.price) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
