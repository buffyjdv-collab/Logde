"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive?: boolean };
  accent?: "emerald" | "rose" | "amber" | "sky" | "violet" | "orange" | "zinc" | "teal";
  hint?: string;
  className?: string;
}

const ACCENT_STYLES: Record<
  NonNullable<StatCardProps["accent"]>,
  { bg: string; text: string; ring: string }
> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
  sky: {
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/20",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
  },
  orange: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/20",
  },
  zinc: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-600 dark:text-zinc-400",
    ring: "ring-zinc-500/20",
  },
  teal: {
    bg: "bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
    ring: "ring-teal-500/20",
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "emerald",
  hint,
  className,
}: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 sm:p-5 hover:shadow-md transition-shadow",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {label}
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-1.5 text-xs font-medium inline-flex items-center gap-1",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "shrink-0 rounded-xl p-2.5 ring-1",
            styles.bg,
            styles.text,
            styles.ring
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
