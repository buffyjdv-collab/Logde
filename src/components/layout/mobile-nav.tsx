"use client";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { ViewKey } from "@/lib/types";
import {
  LayoutDashboard, CalendarCheck, BedDouble, ConciergeBell,
  ShieldCheck, Menu,
} from "lucide-react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

const MOBILE_NAV_TENANT = [
  { key: "dashboard" as ViewKey, label: "Home", icon: LayoutDashboard },
  { key: "rooms" as ViewKey, label: "Rooms", icon: BedDouble },
  { key: "bookings" as ViewKey, label: "Bookings", icon: CalendarCheck },
  { key: "frontdesk" as ViewKey, label: "Desk", icon: ConciergeBell },
];
const MOBILE_NAV_SUPER = [
  { key: "platform_dashboard" as ViewKey, label: "Overview", icon: ShieldCheck },
  { key: "tenants" as ViewKey, label: "Tenants", icon: LayoutDashboard },
];

export function MobileNav() {
  const activeView = useAppStore((s) => s.activeView);
  const setView = useAppStore((s) => s.setView);
  const currentUser = useAppStore((s) => s.currentUser);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const canSeeNav = useAppStore((s) => s.canSeeNav);

  const isSuperAdmin = currentUser?.isSuperAdmin;
  const baseNav = isSuperAdmin ? MOBILE_NAV_SUPER : MOBILE_NAV_TENANT;
  const visibleMobileNav = baseNav.filter((item) => canSeeNav(item.key));

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {visibleMobileNav.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar mobile onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
