"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BADGE_COLOR } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  map: Record<string, { label: string; color: string }>;
  className?: string;
  withDot?: boolean;
}

export function StatusBadge({
  status,
  map,
  className,
  withDot = true,
}: StatusBadgeProps) {
  const config = map[status];
  if (!config) {
    return (
      <Badge variant="outline" className={cn("capitalize", className)}>
        {status}
      </Badge>
    );
  }
  const color = BADGE_COLOR[config.color] || BADGE_COLOR.zinc;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border gap-1.5",
        color.bg,
        color.text,
        color.border,
        className
      )}
    >
      {withDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            `bg-${config.color}-500`
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}
