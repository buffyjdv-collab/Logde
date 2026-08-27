"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IdCard,
  UserPlus,
  Users,
  UserCheck,
  ShieldCheck,
  Pencil,
  History,
  ChevronDown,
  Mail,
  Phone,
  Building2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { staffApi, auditApi } from "@/lib/api";
import { USER_ROLES, formatDate } from "@/lib/constants";
import type { User, AuditLog, UserRole } from "@/lib/types";
import { toast } from "sonner";

interface StaffFormState {
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  active: boolean;
}

const EMPTY_FORM: StaffFormState = {
  name: "",
  email: "",
  role: "receptionist",
  phone: "",
  active: true,
};

export function StaffView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: staffApi.list,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: auditApi.list,
    enabled: auditOpen,
  });

  // ── Stats ───────────────────────────────────────────────────────
  const activeCount = staff.filter((s) => s.active).length;
  const roleCounts: Record<string, number> = {};
  for (const s of staff) {
    roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
  }
  const topRoleEntry = Object.entries(roleCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];

  // ── Mutations ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: StaffFormState) =>
      staffApi.create({
        name: data.name,
        email: data.email,
        role: data.role,
        phone: data.phone || undefined,
      }),
    onSuccess: () => {
      toast.success("Staff member added");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffFormState> }) =>
      staffApi.update(id, data),
    onSuccess: () => {
      toast.success("Staff member updated");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      staffApi.update(id, { active }),
    onMutate: async ({ id, active }) => {
      // Optimistic update for snappy UI
      await queryClient.cancelQueries({ queryKey: ["staff"] });
      const prev = queryClient.getQueryData<User[]>(["staff"]);
      if (prev) {
        queryClient.setQueryData<User[]>(
          ["staff"],
          prev.map((u) => (u.id === id ? { ...u, active } : u))
        );
      }
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["staff"], ctx.prev);
      }
      toast.error(e.message);
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      active: user.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Staff & Team"
        description="Manage team members, their roles, and access to the lodge system."
        icon={<IdCard className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Staff"
          value={staff.length}
          icon={Users}
          accent="emerald"
          hint={`${activeCount} active`}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={UserCheck}
          accent="sky"
          hint={`${staff.length - activeCount} inactive`}
        />
        <StatCard
          label="Distinct Roles"
          value={Object.keys(roleCounts).length}
          icon={ShieldCheck}
          accent="violet"
          hint="Across all staff"
        />
        <StatCard
          label="Top Role"
          value={topRoleEntry ? USER_ROLES[topRoleEntry[0] as UserRole]?.label : "—"}
          icon={IdCard}
          accent="amber"
          hint={topRoleEntry ? `${topRoleEntry[1]} member${topRoleEntry[1] === 1 ? "" : "s"}` : undefined}
        />
      </div>

      {/* Role breakdown chips */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Role
          Distribution
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(USER_ROLES).map(([key, cfg]) => {
            const count = roleCounts[key] || 0;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                  count === 0 && "opacity-50"
                )}
              >
                <StatusBadge status={key} map={USER_ROLES} />
                <span className="font-semibold tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Staff table */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Team Members</h3>
        {isLoading ? (
          <LoadingTable rows={5} />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff yet"
            description="Add your first team member to start managing your lodge."
            action={
              <Button size="sm" onClick={openAdd} className="gap-1.5">
                <UserPlus className="h-4 w-4" /> Add Staff
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="min-w-[140px]">Contact</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              u.active
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.role} map={USER_ROLES} />
                    </TableCell>
                    <TableCell>
                      {u.phone ? (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {u.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No phone</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.property?.name ? (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {u.property.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-center">
                              <Switch
                                checked={u.active}
                                onCheckedChange={(checked) =>
                                  toggleActive.mutate({
                                    id: u.id,
                                    active: checked,
                                  })
                                }
                                aria-label={`Toggle ${u.name} status`}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {u.active ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active — click to deactivate
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Circle className="h-3 w-3 text-zinc-400" /> Inactive — click to activate
                              </span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLogin
                        ? format(new Date(u.lastLogin), "dd MMM yyyy, HH:mm")
                        : (
                          <span className="italic">Never</span>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(u)}
                        className="gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Audit Logs (collapsible) ──────────────────────────────── */}
      <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
        <Card className="p-4 sm:p-5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="rounded-lg bg-violet-500/10 p-1.5">
                  <History className="h-4 w-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Audit Logs</h3>
                  <p className="text-xs text-muted-foreground">
                    Recent system activity across your lodge
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  Last {auditLogs.length || 20} events
                </Badge>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    auditOpen && "rotate-180"
                  )}
                />
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-4 border-t pt-4 max-h-96 overflow-y-auto scrollbar-thin pr-1 -mr-1">
              {auditLogs.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No audit logs yet"
                  description="System actions will appear here as your team uses LodgeHub."
                />
              ) : (
                <ol className="space-y-2">
                  {auditLogs.slice(0, 20).map((log: AuditLog) => (
                    <li
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {log.user?.name?.charAt(0).toUpperCase() || "S"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {log.user?.name || "System"}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-mono capitalize"
                          >
                            {log.action}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-muted-foreground"
                          >
                            {log.entity}
                          </Badge>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-1 break-words">
                            {log.details}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {formatDate(log.createdAt, true)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Add/Edit Dialog ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5 text-emerald-600" />
              {editing ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the team member's details below."
                : "Fill in the details to add a new team member."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full Name *</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Aditya Khanna"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email *</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@lodge.in"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as UserRole })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(USER_ROLES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Active Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive members cannot sign in
                  </p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, active: checked })
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={submitForm}
              disabled={
                createMutation.isPending || updateMutation.isPending
              }
              className="gap-1.5"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving…"
                : editing
                ? "Save Changes"
                : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
