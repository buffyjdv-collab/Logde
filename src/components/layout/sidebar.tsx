"use client";

import { cn } from "@/lib/utils";
import { useAppStore, can } from "@/lib/store";
import { NAV_ITEMS } from "@/lib/constants";
import type { ViewKey } from "@/lib/types";
import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Users,
  ConciergeBell,
  Sparkles,
  ReceiptIndianRupee,
  Wallet,
  BarChart3,
  IdCard,
  Settings,
  Hotel,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  Users,
  ConciergeBell,
  Sparkles,
  ReceiptIndianRupee,
  Wallet,
  BarChart3,
  IdCard,
  Settings,
};

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile, onNavigate }: SidebarProps) {
  const activeView = useAppStore((s) => s.activeView);
  const setView = useAppStore((s) => s.setView);
  const currentUser = useAppStore((s) => s.currentUser);
  const tenantName = useAppStore((s) => s.tenantName);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const visibleItems = NAV_ITEMS.filter((item) =>
    can(currentUser?.role, item.key)
  );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Hotel className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight tracking-tight">
            LodgeHub
          </p>
          <p className="text-xs text-muted-foreground truncate">{tenantName}</p>
        </div>
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Operations
          </p>
          {visibleItems.map((item) => {
            const Icon = ICONS[item.icon] || LayoutDashboard;
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key as ViewKey);
                  onNavigate?.();
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User card */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
            {currentUser?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {currentUser?.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {currentUser?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
