"use client";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { NAV_ITEMS, SUPER_ADMIN_NAV } from "@/lib/constants";
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
  Table2,
  IdCard,
  Settings,
  Hotel,
  X,
  ShieldCheck,
  Building2,
  Percent,
  Crown,
  ScrollText,
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
  Table2,
  IdCard,
  Settings,
  ShieldCheck,
  Building2,
  Percent,
  Crown,
  ScrollText,
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
  const canSeeNav = useAppStore((s) => s.canSeeNav);

  const isSuperAdmin = currentUser?.isSuperAdmin;
  const visibleTenantItems = NAV_ITEMS.filter((item) => canSeeNav(item.key));
  const visibleSuperItems = isSuperAdmin
    ? SUPER_ADMIN_NAV
    : SUPER_ADMIN_NAV.filter((item) => canSeeNav(item.key));

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-sm",
            isSuperAdmin ? "bg-rose-600" : "bg-primary"
          )}
        >
          {isSuperAdmin ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <Hotel className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight tracking-tight">
            {isSuperAdmin ? "LodgeHub Platform" : "LodgeHub"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isSuperAdmin ? "Super Admin Console" : tenantName}
          </p>
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

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {/* Super Admin section */}
          {visibleSuperItems.length > 0 && (
            <>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Super Admin
              </p>
              {visibleSuperItems.map((item) => {
                const Icon = ICONS[item.icon] || ShieldCheck;
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
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-white" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Tenant operations section */}
          {visibleTenantItems.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isSuperAdmin ? "Operations (Demo)" : "Operations"}
              </p>
              {visibleTenantItems.map((item) => {
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
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User card */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors cursor-pointer">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
              isSuperAdmin ? "bg-rose-600/15 text-rose-600" : "bg-primary/15 text-primary"
            )}
          >
            {currentUser?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {isSuperAdmin ? "Super Admin" : currentUser?.role?.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
