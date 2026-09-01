"use client";

import { useMemo, useState } from "react";
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
  Plus,
  Trash2,
  Lock,
  ShieldAlert,
  Crown,
  ListChecks,
  Menu as MenuIcon,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  staffApi,
  auditApi,
  rolesApi,
  usersRbacApi,
} from "@/lib/api";
import { USER_ROLES, NAV_ITEMS, formatDate } from "@/lib/constants";
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
} from "@/lib/permissions";
import type { User, AuditLog, UserRole, Role } from "@/lib/types";
import { toast } from "sonner";

// ── Form state types ────────────────────────────────────────────────

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

interface RoleFormState {
  name: string;
  label: string;
  description: string;
  permissionKeys: Set<string>;
  menuItems: Set<string>;
}

const EMPTY_ROLE_FORM: RoleFormState = {
  name: "",
  label: "",
  description: "",
  permissionKeys: new Set(),
  menuItems: new Set(),
};

// ── Main view ───────────────────────────────────────────────────────

export function StaffView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [auditOpen, setAuditOpen] = useState(false);

  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: staffApi.list,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
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

  const systemRoleCount = roles.filter((r) => r.isSystem).length;
  const customRoleCount = roles.length - systemRoleCount;

  // ── Staff mutations ─────────────────────────────────────────────
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
      queryClient.invalidateQueries({ queryKey: ["roles"] });
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

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersRbacApi.assignRole(userId, roleId),
    onSuccess: () => {
      toast.success("Role assigned");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Role mutations ───────────────────────────────────────────────
  const createRoleMutation = useMutation({
    mutationFn: (data: RoleFormState) =>
      rolesApi.create({
        name: data.name,
        label: data.label,
        description: data.description || undefined,
        permissionKeys: Array.from(data.permissionKeys),
        menuItems: Array.from(data.menuItems),
      }),
    onSuccess: () => {
      toast.success("Role created");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      closeRoleDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Pick<RoleFormState, "permissionKeys" | "menuItems" | "label" | "description">;
    }) =>
      rolesApi.update(id, {
        label: data.label,
        description: data.description || undefined,
        permissionKeys: Array.from(data.permissionKeys),
        menuItems: Array.from(data.menuItems),
      }),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      closeRoleDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      setDeleteRoleId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeleteRoleId(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────
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

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(EMPTY_ROLE_FORM);
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      label: role.label,
      description: role.description || "",
      permissionKeys: new Set(role.permissions.map((p) => p.key)),
      menuItems: new Set(role.menuItems),
    });
    setRoleDialogOpen(true);
  };

  const closeRoleDialog = () => {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleForm(EMPTY_ROLE_FORM);
  };

  const submitRoleForm = () => {
    if (!editingRole) {
      if (!roleForm.name.trim() || !roleForm.label.trim()) {
        toast.error("Role name and label are required");
        return;
      }
    }
    if (editingRole) {
      if (editingRole.isSystem) {
        toast.error("System roles cannot be modified");
        return;
      }
      updateRoleMutation.mutate({ id: editingRole.id, data: roleForm });
    } else {
      createRoleMutation.mutate(roleForm);
    }
  };

  const togglePermission = (key: string, checked: boolean) => {
    setRoleForm((prev) => {
      const next = new Set(prev.permissionKeys);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...prev, permissionKeys: next };
    });
  };

  const toggleMenuItem = (item: string, checked: boolean) => {
    setRoleForm((prev) => {
      const next = new Set(prev.menuItems);
      if (checked) next.add(item);
      else next.delete(item);
      return { ...prev, menuItems: next };
    });
  };

  const toggleModule = (moduleKey: string, checked: boolean) => {
    const modulePerms = PERMISSION_GROUPS[moduleKey] || [];
    setRoleForm((prev) => {
      const next = new Set(prev.permissionKeys);
      for (const p of modulePerms) {
        if (checked) next.add(p.key);
        else next.delete(p.key);
      }
      return { ...prev, permissionKeys: next };
    });
  };

  const roleForDelete = useMemo(
    () => roles.find((r) => r.id === deleteRoleId) || null,
    [roles, deleteRoleId]
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Staff & Roles"
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
          label="Total Roles"
          value={roles.length}
          icon={ShieldCheck}
          accent="violet"
          hint={`${systemRoleCount} system · ${customRoleCount} custom`}
        />
        <StatCard
          label="Top Role"
          value={
            topRoleEntry
              ? USER_ROLES[topRoleEntry[0] as UserRole]?.label
              : "—"
          }
          icon={IdCard}
          accent="amber"
          hint={
            topRoleEntry
              ? `${topRoleEntry[1]} member${
                  topRoleEntry[1] === 1 ? "" : "s"
                }`
              : undefined
          }
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "staff" | "roles")}>
        <TabsList>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Staff Members
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Roles & Permissions
          </TabsTrigger>
        </TabsList>

        {/* ── Staff Members tab ───────────────────────────────────── */}
        <TabsContent value="staff" className="space-y-5">
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Team Members</h3>
              <Badge variant="outline" className="text-xs">
                {staff.length} total
              </Badge>
            </div>
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
                              <p className="text-sm font-medium truncate">
                                {u.name}
                              </p>
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
                            <span className="text-xs text-muted-foreground italic">
                              No phone
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.property?.name ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {u.property.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Unassigned
                            </span>
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
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{" "}
                                    Active — click to deactivate
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Circle className="h-3 w-3 text-zinc-400" />{" "}
                                    Inactive — click to activate
                                  </span>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.lastLogin
                            ? format(
                                new Date(u.lastLogin),
                                "dd MMM yyyy, HH:mm"
                              )
                            : <span className="italic">Never</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  disabled={
                                    assignRoleMutation.isPending &&
                                    assignRoleMutation.variables?.userId ===
                                      u.id
                                  }
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">
                                    Assign Role
                                  </span>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>
                                  Assign a role
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {roles.length === 0 ? (
                                  <div className="px-2 py-3 text-xs text-muted-foreground">
                                    No roles available
                                  </div>
                                ) : (
                                  roles.map((r) => {
                                    const isCurrent =
                                      r.name === u.role || r.label === u.role;
                                    return (
                                      <DropdownMenuItem
                                        key={r.id}
                                        onClick={() =>
                                          assignRoleMutation.mutate({
                                            userId: u.id,
                                            roleId: r.id,
                                          })
                                        }
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <span className="flex items-center gap-2 min-w-0">
                                          {r.isSystem ? (
                                            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                          ) : (
                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                          )}
                                          <span className="truncate">
                                            {r.label}
                                          </span>
                                        </span>
                                        {isCurrent && (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        )}
                                      </DropdownMenuItem>
                                    );
                                  })
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(u)}
                              className="gap-1.5"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* ── Audit Logs (collapsible) ──────────────────────────── */}
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
        </TabsContent>

        {/* ── Roles & Permissions tab ──────────────────────────────── */}
        <TabsContent value="roles" className="space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Roles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Each role bundles permissions and menu items.
                </p>
              </div>
              <Button size="sm" onClick={openCreateRole} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create Role
              </Button>
            </div>

            {roles.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No roles yet"
                description="Create a custom role to fine-tune what your team can access."
                action={
                  <Button size="sm" onClick={openCreateRole} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Create Role
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roles.map((r) => (
                  <RoleCard
                    key={r.id}
                    role={r}
                    onEdit={() => openEditRole(r)}
                    onDelete={() => setDeleteRoleId(r.id)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Permission catalog reference */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Permission Catalog
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {PERMISSION_CATALOG.length} molecular permissions across{" "}
              {Object.keys(PERMISSION_GROUPS).length} modules.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(PERMISSION_GROUPS).map(([module, perms]) => (
                <div
                  key={module}
                  className="rounded-lg border p-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {module}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {perms.length}
                    </Badge>
                  </div>
                  <ul className="space-y-0.5">
                    {perms.map((p) => (
                      <li
                        key={p.key}
                        className="text-xs font-mono text-foreground/80 truncate"
                        title={p.label}
                      >
                        <span className="text-muted-foreground">{p.key}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Staff Dialog ─────────────────────────────────── */}
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

      {/* ── Create/Edit Role Dialog ───────────────────────────────── */}
      <Dialog
        open={roleDialogOpen}
        onOpenChange={(v) => !v && closeRoleDialog()}
      >
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {editingRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {editingRole?.isSystem
                ? "System role — permissions are fixed."
                : editingRole
                ? "Update role permissions and menu items."
                : "Bundle permissions and menu items into a new role."}
            </DialogDescription>
          </DialogHeader>

          {editingRole?.isSystem ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">System role</p>
                <p>
                  This role is part of LodgeHub&apos;s default permission set
                  and cannot be modified. Create a custom role to fine-tune
                  access.
                </p>
              </div>
            </div>
          ) : null}

          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-5">
              {/* Basic fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Role Name *</Label>
                  <Input
                    id="role-name"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, name: e.target.value })
                    }
                    placeholder="e.g. night_auditor"
                    disabled={!!editingRole}
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lowercase, used as the role key
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-label">Display Label *</Label>
                  <Input
                    id="role-label"
                    value={roleForm.label}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, label: e.target.value })
                    }
                    placeholder="e.g. Night Auditor"
                    disabled={!!editingRole?.isSystem}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Input
                  id="role-desc"
                  value={roleForm.description}
                  onChange={(e) =>
                    setRoleForm({ ...roleForm, description: e.target.value })
                  }
                  placeholder="What can this role do?"
                  disabled={!!editingRole?.isSystem}
                />
              </div>

              <Separator />

              {/* Permission matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      Permission Matrix
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {roleForm.permissionKeys.size} of{" "}
                      {PERMISSION_CATALOG.length} permissions selected
                    </p>
                  </div>
                  <Badge variant="outline">
                    {Object.keys(PERMISSION_GROUPS).length} modules
                  </Badge>
                </div>
                <div className="space-y-3">
                  {Object.entries(PERMISSION_GROUPS).map(([module, perms]) => {
                    const selectedInModule = perms.filter((p) =>
                      roleForm.permissionKeys.has(p.key)
                    ).length;
                    const allSelected = selectedInModule === perms.length;
                    const readOnly = !!editingRole?.isSystem;
                    return (
                      <div
                        key={module}
                        className="rounded-lg border p-3 bg-muted/20"
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {module}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {selectedInModule}/{perms.length}
                            </Badge>
                            {!readOnly && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  toggleModule(module, !allSelected)
                                }
                              >
                                {allSelected ? "Clear all" : "Select all"}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {perms.map((p) => {
                            const checked = roleForm.permissionKeys.has(
                              p.key
                            );
                            return (
                              <label
                                key={p.key}
                                className={cn(
                                  "flex items-start gap-2 rounded-md p-2 hover:bg-background transition-colors",
                                  readOnly
                                    ? "cursor-not-allowed opacity-80"
                                    : "cursor-pointer"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) =>
                                    togglePermission(p.key, !!c)
                                  }
                                  disabled={readOnly}
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium">
                                    {p.label}
                                  </p>
                                  {p.description && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {p.description}
                                    </p>
                                  )}
                                  <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5">
                                    {p.key}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Menu items assignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <MenuIcon className="h-4 w-4 text-muted-foreground" />
                      Menu Items
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {roleForm.menuItems.size} of {NAV_ITEMS.length} nav
                      items assigned
                    </p>
                  </div>
                  {!editingRole?.isSystem && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const all = roleForm.menuItems.size === NAV_ITEMS.length;
                        setRoleForm((prev) => ({
                          ...prev,
                          menuItems: new Set(
                            all ? [] : NAV_ITEMS.map((n) => n.key)
                          ),
                        }));
                      }}
                    >
                      {roleForm.menuItems.size === NAV_ITEMS.length
                        ? "Clear all"
                        : "Select all"}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {NAV_ITEMS.map((item) => {
                    const checked = roleForm.menuItems.has(item.key);
                    const readOnly = !!editingRole?.isSystem;
                    return (
                      <label
                        key={item.key}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 hover:bg-muted/30 transition-colors",
                          readOnly
                            ? "cursor-not-allowed opacity-80"
                            : "cursor-pointer",
                          checked && "border-emerald-500/40 bg-emerald-500/5"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            toggleMenuItem(item.key, !!c)
                          }
                          disabled={readOnly}
                        />
                        <span className="text-xs font-medium">
                          {item.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="ghost" onClick={closeRoleDialog}>
              Cancel
            </Button>
            <Button
              onClick={submitRoleForm}
              disabled={
                editingRole?.isSystem ||
                createRoleMutation.isPending ||
                updateRoleMutation.isPending
              }
              className="gap-1.5"
            >
              {createRoleMutation.isPending || updateRoleMutation.isPending
                ? "Saving…"
                : editingRole
                ? "Save Changes"
                : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirmation ──────────────────────────────── */}
      <AlertDialog
        open={!!deleteRoleId}
        onOpenChange={(v) => !v && setDeleteRoleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              Delete role?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleForDelete ? (
                roleForDelete.userCount && roleForDelete.userCount > 0 ? (
                  <>
                    Cannot delete{" "}
                    <span className="font-semibold">
                      {roleForDelete.label}
                    </span>{" "}
                    — it is currently assigned to{" "}
                    {roleForDelete.userCount} user
                    {roleForDelete.userCount === 1 ? "" : "s"}. Reassign or
                    deactivate those users first.
                  </>
                ) : (
                  <>
                    This will permanently delete the{" "}
                    <span className="font-semibold">
                      {roleForDelete.label}
                    </span>{" "}
                    role. This action cannot be undone.
                  </>
                )
              ) : (
                "This will permanently delete the role."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={
                !roleForDelete ||
                roleForDelete.isSystem ||
                (!!roleForDelete.userCount && roleForDelete.userCount > 0) ||
                deleteRoleMutation.isPending
              }
              onClick={() =>
                roleForDelete && deleteRoleMutation.mutate(roleForDelete.id)
              }
            >
              {deleteRoleMutation.isPending ? "Deleting…" : "Delete Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── RoleCard subcomponent ───────────────────────────────────────────

function RoleCard({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const userCount = role.userCount ?? 0;
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold truncate">{role.label}</h4>
            {role.isSystem && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1"
              >
                <Lock className="h-3 w-3" />
                System
              </Badge>
            )}
            {role.isSuperAdmin && (
              <Badge
                variant="outline"
                className="text-[10px] border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 gap-1"
              >
                <Crown className="h-3 w-3" />
                Super
              </Badge>
            )}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            {role.name}
          </p>
        </div>
      </div>

      {role.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {role.description}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-muted/40 px-2.5 py-2 text-center">
          <p className="text-lg font-bold tabular-nums">{userCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Users
          </p>
        </div>
        <div className="rounded-md bg-muted/40 px-2.5 py-2 text-center">
          <p className="text-lg font-bold tabular-nums">
            {role.permissions.length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Perms
          </p>
        </div>
        <div className="rounded-md bg-muted/40 px-2.5 py-2 text-center">
          <p className="text-lg font-bold tabular-nums">
            {role.menuItems.length}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Menus
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          {role.isSystem ? "View" : "Edit Permissions"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={role.isSystem || userCount > 0}
          className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
