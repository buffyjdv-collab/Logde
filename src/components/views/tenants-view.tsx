"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  PauseCircle,
  Sparkles,
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  Pause,
  PlayCircle,
  Mail,
  Phone,
  KeyRound,
  UserCircle,
  Copy,
  Check,
  Lock,
  RefreshCw,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { tenantsApi } from "@/lib/api";
import { BADGE_COLOR, formatDate } from "@/lib/constants";
import type { Tenant } from "@/lib/types";

const TENANT_STATUS_MAP: Record<string, { label: string; color: string }> = {
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

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter — ₹999/mo" },
  { value: "growth", label: "Growth — ₹2,499/mo" },
  { value: "scale", label: "Scale — ₹4,999/mo" },
  { value: "enterprise", label: "Enterprise — ₹9,999/mo" },
];

const FEE_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (% of revenue)" },
  { value: "fixed_monthly", label: "Fixed Monthly (₹/month)" },
  { value: "per_booking", label: "Per Booking (₹/booking)" },
];

type OwnerCredentials = {
  ownerName: string;
  email: string;
  password: string;
  userId: string;
  loginUrl: string;
};

type CredentialsResult = {
  title: string;
  tenantName: string;
  credentials: OwnerCredentials;
};

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { label: plan, color: "zinc" };
  const color = BADGE_COLOR[cfg.color] ?? BADGE_COLOR.zinc;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium border capitalize", color.bg, color.text, color.border)}
    >
      {cfg.label}
    </Badge>
  );
}

/**
 * Reusable credentials display: prominent emerald-bordered box with the
 * owner login URL / email / password, a per-field copy button, a
 * "Copy credentials" button (copies all three), and a show/hide toggle
 * on the password. Used both after tenant creation and after password reset.
 */
function CredentialsDisplay({ credentials }: { credentials: OwnerCredentials }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | "all" | null>(null);

  const copy = (text: string, kind: "email" | "password" | "all") => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      !navigator.clipboard.writeText
    ) {
      toast.error("Clipboard not available in this browser");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(kind);
        toast.success("Credentials copied to clipboard");
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => toast.error("Failed to copy"));
  };

  const copyAll = () => {
    const text = [
      `Login URL: ${credentials.loginUrl}`,
      `Email: ${credentials.email}`,
      `Password: ${credentials.password}`,
    ].join("\n");
    copy(text, "all");
  };

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Owner Login Credentials
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyAll}
          className="h-7 text-xs"
        >
          {copied === "all" ? (
            <Check className="h-3 w-3 mr-1" />
          ) : (
            <Copy className="h-3 w-3 mr-1" />
          )}
          Copy credentials
        </Button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Login URL
          </span>
          <code className="text-xs font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
            {credentials.loginUrl}
          </code>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </span>
          <div className="flex items-center gap-1.5">
            <code className="text-xs font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
              {credentials.email}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => copy(credentials.email, "email")}
              aria-label="Copy email"
            >
              {copied === "email" ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Password
          </span>
          <div className="flex items-center gap-1.5">
            <code className="text-xs font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
              {show
                ? credentials.password
                : "•".repeat(Math.max(credentials.password.length, 6))}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => copy(credentials.password, "password")}
              aria-label="Copy password"
            >
              {copied === "password" ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TenantFormState {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  plan: string;
  feeType: string;
  feeValue: string;
  status: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
}

const EMPTY_FORM: TenantFormState = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  plan: "starter",
  feeType: "percentage",
  feeValue: "5",
  status: "active",
  ownerName: "",
  ownerEmail: "",
  password: "",
};

export function TenantsView() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [viewing, setViewing] = useState<Tenant | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [resetTarget, setResetTarget] = useState<Tenant | null>(null);
  const [ownerInfoTarget, setOwnerInfoTarget] = useState<Tenant | null>(null);
  const [credentialsResult, setCredentialsResult] =
    useState<CredentialsResult | null>(null);
  const [form, setForm] = useState<TenantFormState>(EMPTY_FORM);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["tenants"],
    queryFn: tenantsApi.list,
  });

  // Fetch tenant+owner details when the Owner Info dialog opens.
  const { data: ownerData, isLoading: ownerLoading } = useQuery({
    queryKey: ["tenant-owner", ownerInfoTarget?.id],
    queryFn: () => tenantsApi.get(ownerInfoTarget!.id),
    enabled: !!ownerInfoTarget,
  });

  const filtered = useMemo(() => {
    let list = tenants;
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tenants, statusFilter, search]);

  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "active").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
    const now = new Date();
    const newThisMonth = tenants.filter((t) => {
      const d = new Date(t.createdAt);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;
    return { total, active, suspended, newThisMonth };
  }, [tenants]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      contactEmail: string;
      contactPhone?: string;
      address?: string;
      plan?: string;
      feeType?: string;
      feeValue?: number;
      ownerName?: string;
      ownerEmail?: string;
      password?: string;
    }) => tenantsApi.create(data),
    onSuccess: (data) => {
      toast.success("Tenant created successfully");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setCredentialsResult({
        title: "Tenant created successfully!",
        tenantName: data.name,
        credentials: data.credentials,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      tenantsApi.update(id, data),
    onSuccess: () => {
      toast.success("Tenant updated");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tenantsApi.update(id, { status } as Partial<Tenant>),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === "suspended" ? "Tenant suspended" : "Tenant reactivated"
      );
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      setSuspendTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.resetPassword(id),
    onSuccess: (data, tenantId) => {
      toast.success("Owner password reset");
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["super-dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["tenant-owner", tenantId],
      });
      setResetTarget(null);
      const tenant = tenants.find((t) => t.id === tenantId);
      setCredentialsResult({
        title: "Owner password reset successfully!",
        tenantName: tenant?.name ?? data.ownerName,
        credentials: {
          ownerName: data.ownerName,
          email: data.email,
          password: data.password,
          userId: "",
          loginUrl: "/",
        },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setForm({
      name: t.name,
      contactEmail: t.contactEmail,
      contactPhone: t.contactPhone ?? "",
      address: t.address ?? "",
      plan: t.plan,
      feeType: "percentage",
      feeValue: "5",
      status: t.status,
      ownerName: "",
      ownerEmail: "",
      password: "",
    });
    setEditing(t);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contactEmail.trim()) {
      toast.error("Name and contact email are required");
      return;
    }
    const feeVal = Number(form.feeValue);
    if (Number.isNaN(feeVal) || feeVal < 0) {
      toast.error("Fee value must be a non-negative number");
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          name: form.name.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim() || undefined,
          address: form.address.trim() || undefined,
          plan: form.plan,
          status: form.status,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        plan: form.plan,
        feeType: form.feeType,
        feeValue: feeVal,
        ownerName: form.ownerName.trim() || undefined,
        ownerEmail: form.ownerEmail.trim() || undefined,
        password: form.password.trim() || undefined,
      });
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage all tenants on the LodgeHub platform"
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" /> Create Tenant
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Tenants"
          value={stats.total}
          icon={Building2}
          accent="rose"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Suspended"
          value={stats.suspended}
          icon={PauseCircle}
          accent="rose"
        />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          icon={Sparkles}
          accent="violet"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tenants table */}
      <Card className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-4">
              <LoadingTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tenants found"
              description={
                tenants.length === 0
                  ? "Create your first tenant to get started."
                  : "Try adjusting your filters."
              }
              action={
                tenants.length === 0 ? (
                  <Button onClick={openCreate} size="sm">
                    <Plus className="h-4 w-4" /> Create Tenant
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
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
                      <div className="flex flex-col text-xs">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {t.contactEmail}
                        </span>
                        {t.contactPhone && (
                          <span className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <Phone className="h-3 w-3" />
                            {t.contactPhone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={t.plan} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} map={TENANT_STATUS_MAP} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(t)}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setOwnerInfoTarget(t)}
                          >
                            <UserCircle className="h-4 w-4 mr-2" /> Owner Info
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(t)}>
                            <KeyRound className="h-4 w-4 mr-2" /> Reset Owner
                            Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {t.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => setSuspendTarget(t)}
                              className="text-rose-600 dark:text-rose-400"
                            >
                              <Pause className="h-4 w-4 mr-2" /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: t.id,
                                  status: "active",
                                })
                              }
                              className="text-emerald-600 dark:text-emerald-400"
                            >
                              <PlayCircle className="h-4 w-4 mr-2" /> Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreateOpen(false);
            setEditing(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Tenant" : "Create New Tenant"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update tenant details and platform fee configuration."
                : "Add a new tenant to the platform. An owner login will be created automatically."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">Tenant Name *</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pine Valley Resort"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-email">Contact Email *</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  placeholder="owner@pinevalley.in"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-phone">Contact Phone</Label>
                <Input
                  id="t-phone"
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm({ ...form, contactPhone: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-address">Address</Label>
              <Input
                id="t-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Manali, Himachal Pradesh"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-plan">Subscription Plan</Label>
                <Select
                  value={form.plan}
                  onValueChange={(v) => setForm({ ...form, plan: v })}
                >
                  <SelectTrigger id="t-plan" className="w-full">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="t-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger id="t-status" className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {!editing && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-3">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                  Initial Platform Fee Configuration
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="t-feetype">Fee Type</Label>
                    <Select
                      value={form.feeType}
                      onValueChange={(v) =>
                        setForm({ ...form, feeType: v })
                      }
                    >
                      <SelectTrigger id="t-feetype" className="w-full">
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
                    <Label htmlFor="t-feevalue">
                      Fee Value{" "}
                      <span className="text-muted-foreground text-xs">
                        ({form.feeType === "percentage" ? "%" : "₹"})
                      </span>
                    </Label>
                    <Input
                      id="t-feevalue"
                      type="number"
                      min="0"
                      step={form.feeType === "percentage" ? "0.5" : "100"}
                      value={form.feeValue}
                      onChange={(e) =>
                        setForm({ ...form, feeValue: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            {!editing && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Owner Login Credentials
                  </p>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  An owner account is created automatically. Leave fields blank
                  to use the tenant name and contact email; leave the password
                  blank to auto-generate an 8-character one.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="t-owner-name">Owner Name</Label>
                    <Input
                      id="t-owner-name"
                      value={form.ownerName}
                      onChange={(e) =>
                        setForm({ ...form, ownerName: e.target.value })
                      }
                      placeholder="Owner's full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-owner-email">Owner Email</Label>
                    <Input
                      id="t-owner-email"
                      type="email"
                      value={form.ownerEmail}
                      onChange={(e) =>
                        setForm({ ...form, ownerEmail: e.target.value })
                      }
                      placeholder="owner@lodge.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-owner-password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="t-owner-password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder="Leave blank to auto-generate"
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm({ ...form, password: generatePassword(8) })
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Auto-generate
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditing(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving…"
                  : editing
                  ? "Save Changes"
                  : "Create Tenant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Success Dialog (reused for create + reset password) */}
      <Dialog
        open={!!credentialsResult}
        onOpenChange={(v) => !v && setCredentialsResult(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {credentialsResult?.title ?? "Success"}
            </DialogTitle>
            <DialogDescription>
              Share these credentials securely with the tenant owner.
            </DialogDescription>
          </DialogHeader>
          {credentialsResult && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="font-medium text-sm">
                  {credentialsResult.tenantName}
                </p>
              </div>
              <CredentialsDisplay credentials={credentialsResult.credentials} />
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Share these credentials securely with the tenant owner. The
                  password will not be shown again.
                </span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentialsResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Info Dialog */}
      <Dialog
        open={!!ownerInfoTarget}
        onOpenChange={(v) => !v && setOwnerInfoTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              Owner Info
            </DialogTitle>
            <DialogDescription>
              Owner account details for {ownerInfoTarget?.name}
            </DialogDescription>
          </DialogHeader>
          {ownerLoading ? (
            <div className="space-y-2 py-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ) : ownerData?.owner ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                  <UserCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-base">
                    {ownerData.owner.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Owner account
                  </p>
                </div>
              </div>
              <DetailRow label="Name">{ownerData.owner.name}</DetailRow>
              <DetailRow label="Email">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {ownerData.owner.email}
                </span>
              </DetailRow>
              {ownerData.owner.phone && (
                <DetailRow label="Phone">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {ownerData.owner.phone}
                  </span>
                </DetailRow>
              )}
              <DetailRow label="Status">
                {ownerData.owner.active ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-rose-100 text-rose-700 border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400">
                    Inactive
                  </Badge>
                )}
              </DetailRow>
              <DetailRow label="Last Login">
                {ownerData.owner.lastLogin
                  ? formatDate(ownerData.owner.lastLogin)
                  : "Never"}
              </DetailRow>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <UserCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                No owner account is linked to this tenant. Use{" "}
                <strong>Reset Owner Password</strong> to provision one.
              </span>
            </div>
          )}
          <DialogFooter>
            <div className="flex items-center justify-between w-full gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (ownerInfoTarget) {
                    setResetTarget(ownerInfoTarget);
                    setOwnerInfoTarget(null);
                  }
                }}
              >
                <KeyRound className="h-4 w-4" /> Reset Password
              </Button>
              <Button onClick={() => setOwnerInfoTarget(null)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tenant Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-rose-500/10 p-3 text-rose-600 dark:text-rose-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-base">{viewing.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {viewing.slug}
                  </p>
                </div>
              </div>
              <DetailRow label="Status">
                <StatusBadge
                  status={viewing.status}
                  map={TENANT_STATUS_MAP}
                />
              </DetailRow>
              <DetailRow label="Plan">
                <PlanBadge plan={viewing.plan} />
              </DetailRow>
              <DetailRow label="Contact Email">{viewing.contactEmail}</DetailRow>
              {viewing.contactPhone && (
                <DetailRow label="Contact Phone">{viewing.contactPhone}</DetailRow>
              )}
              {viewing.address && (
                <DetailRow label="Address">{viewing.address}</DetailRow>
              )}
              <DetailRow label="Currency">{viewing.currency}</DetailRow>
              <DetailRow label="Timezone">{viewing.timezone}</DetailRow>
              <DetailRow label="Created">
                {formatDate(viewing.createdAt)}
              </DetailRow>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (viewing) openEdit(viewing);
                setViewing(null);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / Activate confirm */}
      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={(v) => !v && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.name} will be suspended immediately. Their staff
              will lose access until the tenant is reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (suspendTarget) {
                  toggleStatusMutation.mutate({
                    id: suspendTarget.id,
                    status: "suspended",
                  });
                }
              }}
            >
              Suspend Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Owner Password confirm */}
      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset owner password?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget?.name}&apos;s owner account will receive a new
              auto-generated password. The previous password will no longer
              work. The new credentials will be shown to you once the reset is
              complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={resetPasswordMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (resetTarget) {
                  resetPasswordMutation.mutate(resetTarget.id);
                }
              }}
            >
              {resetPasswordMutation.isPending ? "Resetting…" : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}
