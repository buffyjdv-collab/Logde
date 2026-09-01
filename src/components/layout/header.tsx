"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Menu, Bell, Sun, Moon, Plus, LogIn, LogOut, CreditCard,
  ShieldCheck, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar } from "./sidebar";
import { useAppStore } from "@/lib/store";
import { notificationsApi } from "@/lib/api";
import { formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  const currentUser = useAppStore((s) => s.currentUser);
  const isSuperAdmin = currentUser?.isSuperAdmin;
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 30000,
    enabled: !isSuperAdmin,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const switchPersona = async (as: "superadmin" | "owner") => {
    try {
      const res = await fetch(`/api/auth/me?as=${as}`);
      const data = await res.json();
      useAppStore.getState().setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        roleId: data.roleId,
        avatar: data.avatar,
        isSuperAdmin: data.isSuperAdmin,
        permissions: data.permissions || [],
        menuItems: data.menuItems || [],
      });
      if (data.tenant) {
        useAppStore.getState().setTenant(data.tenant.id, data.tenant.name);
      }
      queryClient.clear();
      if (as === "superadmin") {
        useAppStore.getState().setView("platform_dashboard");
        toast.success("Switched to Super Admin");
      } else {
        useAppStore.getState().setView("dashboard");
        toast.success("Switched to Lodge Owner");
      }
    } catch {
      toast.error("Failed to switch persona");
    }
  };

  const notifIcon = (type: string) => {
    const map: Record<string, string> = {
      check_in: "bg-emerald-500/10 text-emerald-600",
      check_out: "bg-amber-500/10 text-amber-600",
      payment: "bg-sky-500/10 text-sky-600",
      maintenance: "bg-orange-500/10 text-orange-600",
      booking: "bg-violet-500/10 text-violet-600",
      system: "bg-zinc-500/10 text-zinc-600",
      platform_fee: "bg-rose-500/10 text-rose-600",
    };
    return map[type] || map.system;
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-3 sm:px-5">
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <Sidebar mobile onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Quick actions (desktop) — only for tenant ops */}
      {!isSuperAdmin && (
        <div className="hidden md:flex items-center gap-2">
          <Button size="sm" onClick={() => setQuickAction("new_booking")} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Booking
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickAction("check_in")} className="gap-1.5">
            <LogIn className="h-4 w-4" /> Check-In
          </Button>
          <Button size="sm" variant="outline" onClick={() => setQuickAction("check_out")} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Check-Out
          </Button>
        </div>
      )}

      <div className="flex-1" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      {/* Persona switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            {isSuperAdmin ? (
              <ShieldCheck className="h-4 w-4 text-rose-600" />
            ) : (
              <Building2 className="h-4 w-4 text-primary" />
            )}
            <span className="hidden sm:inline">
              {isSuperAdmin ? "Super Admin" : "Lodge"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch View
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => switchPersona("superadmin")}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Super Admin Console
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => switchPersona("owner")}>
            <Building2 className="mr-2 h-4 w-4" />
            Lodge Owner (Pine Valley)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications (tenant only) */}
      {!isSuperAdmin && (
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 sm:w-96 p-0" align="end">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto py-1 text-xs" onClick={() => markAllRead.mutate()}>
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => (
                    <div key={n.id} className={cn("flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors", !n.read && "bg-primary/[0.03]")}>
                      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", notifIcon(n.type))}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">{formatDate(n.createdAt, true)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Payment quick action (mobile) */}
      {!isSuperAdmin && (
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setQuickAction("payment")} aria-label="Quick payment">
          <CreditCard className="h-[18px] w-[18px]" />
        </Button>
      )}
    </header>
  );
}
