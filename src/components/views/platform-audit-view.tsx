"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ScrollText,
  Download,
  Building2,
  Filter,
  User as UserIcon,
  Activity,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { tenantsApi } from "@/lib/api";
import { BADGE_COLOR, formatDate } from "@/lib/constants";
import type { AuditLog, Tenant, User } from "@/lib/types";

// Audit log returned by /api/super/audit — extends the base AuditLog with a
// populated tenant + user record.
interface PlatformAuditLog extends AuditLog {
  tenantId?: string;
  userId?: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

const ACTION_COLOR: Record<string, { label: string; color: string }> = {
  create: { label: "Create", color: "emerald" },
  update: { label: "Update", color: "sky" },
  patch: { label: "Update", color: "sky" },
  delete: { label: "Delete", color: "rose" },
  remove: { label: "Delete", color: "rose" },
  login: { label: "Login", color: "violet" },
  logout: { label: "Logout", color: "zinc" },
  check_in: { label: "Check-In", color: "sky" },
  check_out: { label: "Check-Out", color: "violet" },
  cancel: { label: "Cancel", color: "rose" },
  payment: { label: "Payment", color: "emerald" },
  suspend: { label: "Suspend", color: "rose" },
  activate: { label: "Activate", color: "emerald" },
  record: { label: "Record", color: "emerald" },
  pay: { label: "Pay", color: "emerald" },
  assign: { label: "Assign", color: "violet" },
};

function actionLabel(action: string): { label: string; color: string } {
  const lower = action.toLowerCase();
  // Look for known keywords within the action string
  for (const key of Object.keys(ACTION_COLOR)) {
    if (lower.includes(key)) {
      return ACTION_COLOR[key];
    }
  }
  return { label: action, color: "zinc" };
}

function ActionBadge({ action }: { action: string }) {
  const cfg = actionLabel(action);
  const color = BADGE_COLOR[cfg.color] ?? BADGE_COLOR.zinc;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border capitalize",
        color.bg,
        color.text,
        color.border
      )}
    >
      {cfg.label}
    </Badge>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  return (
    <Badge variant="outline" className="font-mono text-xs capitalize">
      {entity}
    </Badge>
  );
}

export function PlatformAuditView() {
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: tenantsApi.list,
  });

  const { data: logs = [], isLoading } = useQuery<PlatformAuditLog[]>({
    queryKey: ["platform-audit"],
    queryFn: async () => {
      const r = await fetch("/api/super/audit");
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${r.status}`);
      }
      return r.json();
    },
    refetchOnMount: true,
  });

  // Build list of unique entity types from the logs for the entity filter
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.entity);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let list = logs;
    if (tenantFilter !== "all") {
      list = list.filter((l) => l.tenantId === tenantFilter);
    }
    if (entityFilter !== "all") {
      list = list.filter((l) => l.entity === entityFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) => {
        const u = l.user as User | undefined | null;
        return (
          l.action.toLowerCase().includes(q) ||
          l.entity.toLowerCase().includes(q) ||
          (l.details ?? "").toLowerCase().includes(q) ||
          (u?.name ?? "").toLowerCase().includes(q) ||
          (l.tenant?.name ?? "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [logs, tenantFilter, entityFilter, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const today = new Date();
    const todayCount = logs.filter((l) => {
      const d = new Date(l.createdAt);
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    }).length;
    const distinctTenants = new Set(logs.map((l) => l.tenantId)).size;
    const distinctUsers = new Set(
      logs.map((l) => l.userId).filter(Boolean)
    ).size;
    return { total, todayCount, distinctTenants, distinctUsers };
  }, [logs]);

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("No audit logs to export");
      return;
    }
    const rows: string[][] = [
      [
        "Timestamp",
        "Tenant",
        "User",
        "Action",
        "Entity",
        "Entity ID",
        "Details",
      ],
      ...filtered.map((l) => {
        const u = l.user as User | undefined | null;
        return [
          l.createdAt,
          l.tenant?.name ?? "",
          u?.name ?? "",
          l.action,
          l.entity,
          l.entityId ?? "",
          l.details ?? "",
        ].map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        });
      }),
    ];
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lodgehub-platform-audit-${format(
      new Date(),
      "yyyy-MM-dd"
    )}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} audit logs`);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Cross-tenant activity trail"
        icon={<ScrollText className="h-5 w-5" />}
        actions={
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            disabled={!logs.length}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Logs"
          value={stats.total}
          icon={ScrollText}
          accent="rose"
        />
        <StatCard
          label="Today"
          value={stats.todayCount}
          icon={Activity}
          accent="violet"
        />
        <StatCard
          label="Active Tenants"
          value={stats.distinctTenants}
          icon={Building2}
          accent="emerald"
        />
        <StatCard
          label="Distinct Users"
          value={stats.distinctUsers}
          icon={UserIcon}
          accent="sky"
        />
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entityOptions.map((e) => (
                  <SelectItem key={e} value={e}>
                    <span className="capitalize">{e}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action / user / details…"
              className="h-8"
            />
          </div>
        </div>
      </Card>

      {/* Audit table */}
      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 sm:px-6">
          <h3 className="text-base font-semibold">Recent Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing {filtered.length} of {logs.length} most recent audit logs
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4">
              <LoadingTable rows={6} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit logs found"
              description={
                logs.length === 0
                  ? "Cross-tenant activity will appear here as actions occur."
                  : "Try adjusting your filters."
              }
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const u = l.user as User | undefined | null;
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap align-top">
                        {formatDate(l.createdAt, true)}
                      </TableCell>
                      <TableCell className="align-top">
                        {l.tenant ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {l.tenant.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {l.tenant.slug}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {u ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {u.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {u.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            System
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <ActionBadge action={l.action} />
                      </TableCell>
                      <TableCell className="align-top">
                        <EntityBadge entity={l.entity} />
                      </TableCell>
                      <TableCell className="align-top text-sm max-w-[420px]">
                        {l.details ? (
                          <span className="text-foreground/90 break-words">
                            {l.details}
                          </span>
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
    </div>
  );
}
