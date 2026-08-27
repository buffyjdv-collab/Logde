"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  RefreshCw,
  BedDouble,
  Building2,
  Flag,
  Clock,
  CheckCircle2,
  ArrowRightCircle,
  UserCircle2,
  Ban,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, LoadingTable } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { housekeepingApi } from "@/lib/api";
import { HOUSEKEEPING_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { HousekeepingTask, HousekeepingStatus } from "@/lib/types";

// Column ordering for the Kanban board.
const COLUMN_ORDER: HousekeepingStatus[] = [
  "pending",
  "in_progress",
  "inspection",
  "done",
];

// Status transitions (next steps from each state).
const NEXT_STATUS: Partial<Record<HousekeepingStatus, HousekeepingStatus>> = {
  pending: "in_progress",
  in_progress: "inspection",
  inspection: "done",
};

const PRIORITY_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  high: {
    label: "High",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  },
  normal: {
    label: "Normal",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  low: {
    label: "Low",
    className:
      "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400",
  },
};

export function HousekeepingView() {
  const queryClient = useQueryClient();
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["housekeeping"],
    queryFn: () => housekeepingApi.list(),
    refetchInterval: 30000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HousekeepingStatus }) =>
      housekeepingApi.update(id, { status }),
    onSuccess: (task, vars) => {
      if (vars.status === "done") {
        toast.success(
          `Room ${task.room.number} marked clean and available`,
          { icon: "✓" }
        );
      } else {
        toast.success(
          `Room ${task.room.number} moved to ${
            HOUSEKEEPING_STATUS[vars.status]?.label ?? vars.status
          }`
        );
      }
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (assigneeFilter === "all") return tasks;
    if (assigneeFilter === "unassigned") {
      return tasks.filter((t) => !t.assignedTo);
    }
    return tasks.filter((t) => t.assignedTo?.id === assigneeFilter);
  }, [tasks, assigneeFilter]);

  const blocked = filtered.filter((t) => t.status === "blocked");
  const active = filtered.filter((t) => t.status !== "blocked");

  const columns = useMemo(() => {
    const map: Record<HousekeepingStatus, HousekeepingTask[]> = {
      pending: [],
      in_progress: [],
      inspection: [],
      done: [],
      blocked,
    };
    for (const t of active) {
      if (COLUMN_ORDER.includes(t.status as HousekeepingStatus)) {
        map[t.status as HousekeepingStatus].push(t);
      }
    }
    return map;
  }, [active, blocked]);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    inspection: tasks.filter((t) => t.status === "inspection").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  // Build a unique list of assignees for the filter dropdown.
  const assignees = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    tasks.forEach((t) => {
      if (t.assignedTo && !seen.has(t.assignedTo.id)) {
        seen.set(t.assignedTo.id, { id: t.assignedTo.id, name: t.assignedTo.name });
      }
    });
    return Array.from(seen.values());
  }, [tasks]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Housekeeping"
        description="Track room cleaning tasks and inspection status."
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AssigneeFilter
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              assignees={assignees}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["housekeeping"] })}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Tasks" value={stats.total} icon={ClipboardList} accent="violet" />
        <StatCard label="To Clean" value={stats.pending} icon={Clock} accent="amber" />
        <StatCard label="In Progress" value={stats.inProgress} icon={RefreshCw} accent="sky" />
        <StatCard label="Inspection" value={stats.inspection} icon={Flag} accent="violet" />
        <StatCard label="Done" value={stats.done} icon={CheckCircle2} accent="emerald" />
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <Card className="p-4">
          <LoadingTable rows={6} />
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={Sparkles}
            title="No housekeeping tasks"
            description="Tasks are created automatically when a guest checks out or a room is marked for maintenance."
          />
        </Card>
      ) : (
        <>
          {/* Desktop: 4 columns side-by-side */}
          <div className="hidden md:grid grid-cols-4 gap-4 items-start">
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columns[status]}
                onAdvance={(id) =>
                  updateMut.mutate({ id, status: NEXT_STATUS[status]! })
                }
                onMove={(id, s) => updateMut.mutate({ id, status: s })}
                isPending={updateMut.isPending}
              />
            ))}
          </div>

          {/* Mobile: vertical stack */}
          <div className="md:hidden space-y-4">
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columns[status]}
                onAdvance={(id) =>
                  updateMut.mutate({ id, status: NEXT_STATUS[status]! })
                }
                onMove={(id, s) => updateMut.mutate({ id, status: s })}
                isPending={updateMut.isPending}
                stacked
              />
            ))}
          </div>

          {/* Blocked section */}
          {blocked.length > 0 && (
            <Card className="p-4 sm:p-5 border-zinc-500/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-zinc-500/10 p-1.5">
                    <Ban className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Blocked Rooms</h3>
                    <p className="text-xs text-muted-foreground">
                      Rooms held out of service and not part of the regular
                      cleaning flow.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400">
                  {blocked.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {blocked.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onAdvance={(id) =>
                      updateMut.mutate({ id, status: "pending" })
                    }
                    onMove={(id, s) => updateMut.mutate({ id, status: s })}
                    isPending={updateMut.isPending}
                    advanceLabel="Reopen as To Clean"
                    advanceDisabled
                  />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Assignee filter dropdown ─────────────────────────────────────────────

function AssigneeFilter({
  value,
  onChange,
  assignees,
}: {
  value: string;
  onChange: (v: string) => void;
  assignees: { id: string; name: string }[];
}) {
  const label =
    value === "all"
      ? "All staff"
      : value === "unassigned"
      ? "Unassigned"
      : assignees.find((a) => a.id === value)?.name ?? "All staff";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserCircle2 className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by assignee</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange("all")}>
          All staff
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("unassigned")}>
          Unassigned
        </DropdownMenuItem>
        {assignees.length > 0 && <DropdownMenuSeparator />}
        {assignees.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => onChange(a.id)}>
            {a.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Kanban column ────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  onAdvance,
  onMove,
  isPending,
  stacked = false,
}: {
  status: HousekeepingStatus;
  tasks: HousekeepingTask[];
  onAdvance: (id: string) => void;
  onMove: (id: string, s: HousekeepingStatus) => void;
  isPending: boolean;
  stacked?: boolean;
}) {
  const config = HOUSEKEEPING_STATUS[status];
  const dotColor =
    config?.color === "amber"
      ? "bg-amber-500"
      : config?.color === "sky"
      ? "bg-sky-500"
      : config?.color === "violet"
      ? "bg-violet-500"
      : "bg-emerald-500";
  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden p-0",
        stacked && "max-h-none"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dotColor)} />
          <span className="text-sm font-semibold">{config?.label ?? status}</span>
        </div>
        <Badge variant="secondary" className="font-mono">
          {tasks.length}
        </Badge>
      </div>
      <div
        className={cn(
          "p-2.5 space-y-2",
          stacked
            ? "max-h-72"
            : "max-h-[60vh] overflow-y-auto scrollbar-thin"
        )}
      >
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No tasks
          </p>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onAdvance={onAdvance}
              onMove={onMove}
              isPending={isPending}
            />
          ))
        )}
      </div>
    </Card>
  );
}

// ── Task card ────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onAdvance,
  onMove,
  isPending,
  advanceLabel,
  advanceDisabled = false,
}: {
  task: HousekeepingTask;
  onAdvance: (id: string) => void;
  onMove: (id: string, s: HousekeepingStatus) => void;
  isPending: boolean;
  advanceLabel?: string;
  advanceDisabled?: boolean;
}) {
  const next = NEXT_STATUS[task.status as HousekeepingStatus];
  const priority = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.normal;
  return (
    <div className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-base font-bold leading-none">
              {task.room.number}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0", priority.className)}
            >
              <Flag className="h-2.5 w-2.5 mr-1" />
              {priority.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {task.room.roomType.name} · Floor {task.room.floor}
          </p>
        </div>
        <StatusBadge
          status={task.status}
          map={HOUSEKEEPING_STATUS}
          withDot={false}
        />
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        {task.assignedTo ? (
          <>
            <UserCircle2 className="h-3.5 w-3.5" />
            <span className="truncate">{task.assignedTo.name}</span>
          </>
        ) : (
          <span className="italic">Unassigned</span>
        )}
      </div>

      {/* Notes */}
      {task.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 italic">
          “{task.notes}”
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2.5">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(task.createdAt, "dd MMM, hh:mm a")}
        </span>
        {task.completedAt && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            {format(task.completedAt, "dd MMM")}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {next && !advanceDisabled && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1 gap-1"
            disabled={isPending}
            onClick={() => onAdvance(task.id)}
          >
            <ArrowRightCircle className="h-3.5 w-3.5" />
            {advanceLabel ?? `→ ${HOUSEKEEPING_STATUS[next].label}`}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={isPending}
              aria-label="Move to status"
            >
              <Building2 className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(
              Object.keys(HOUSEKEEPING_STATUS) as HousekeepingStatus[]
            ).map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === task.status}
                onClick={() => onMove(task.id, s)}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full mr-2",
                    HOUSEKEEPING_STATUS[s]?.color === "amber"
                      ? "bg-amber-500"
                      : HOUSEKEEPING_STATUS[s]?.color === "sky"
                      ? "bg-sky-500"
                      : HOUSEKEEPING_STATUS[s]?.color === "violet"
                      ? "bg-violet-500"
                      : HOUSEKEEPING_STATUS[s]?.color === "emerald"
                      ? "bg-emerald-500"
                      : "bg-zinc-500"
                  )}
                />
                {HOUSEKEEPING_STATUS[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
