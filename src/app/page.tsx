"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { QueryProvider } from "@/components/query-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LoginScreen } from "@/components/views/login-screen";
import { NewBookingDialog } from "@/components/views/new-booking-dialog";
import { CheckInDialog } from "@/components/views/check-in-dialog";
import { CheckOutDialog } from "@/components/views/check-out-dialog";
import { PaymentDialog } from "@/components/views/payment-dialog";
import { DashboardView } from "@/components/views/dashboard-view";
import { BookingsView } from "@/components/views/bookings-view";
import { RoomsView } from "@/components/views/rooms-view";
import { GuestsView } from "@/components/views/guests-view";
import { FrontDeskView } from "@/components/views/frontdesk-view";
import { HousekeepingView } from "@/components/views/housekeeping-view";
import { PaymentsView } from "@/components/views/payments-view";
import { ExpensesView } from "@/components/views/expenses-view";
import { RevenueReportView } from "@/components/views/revenue-report-view";
import { StaffView } from "@/components/views/staff-view";
import { SettingsView } from "@/components/views/settings-view";
import { PlatformDashboardView } from "@/components/views/platform-dashboard-view";
import { TenantsView } from "@/components/views/tenants-view";
import { PlatformFeesView } from "@/components/views/platform-fees-view";
import { PlatformPlansView } from "@/components/views/platform-plans-view";
import { PlatformAuditView } from "@/components/views/platform-audit-view";

function QuickActions() {
  const quickAction = useAppStore((s) => s.quickAction);
  const setQuickAction = useAppStore((s) => s.setQuickAction);
  return (
    <>
      <NewBookingDialog
        open={quickAction === "new_booking"}
        onOpenChange={(v) => !v && setQuickAction(null)}
      />
      <CheckInDialog
        open={quickAction === "check_in"}
        onOpenChange={(v) => !v && setQuickAction(null)}
      />
      <CheckOutDialog
        open={quickAction === "check_out"}
        onOpenChange={(v) => !v && setQuickAction(null)}
      />
      <PaymentDialog
        open={quickAction === "payment"}
        onOpenChange={(v) => !v && setQuickAction(null)}
      />
    </>
  );
}

function ActiveView() {
  const activeView = useAppStore((s) => s.activeView);
  switch (activeView) {
    case "dashboard":
      return <DashboardView />;
    case "bookings":
      return <BookingsView />;
    case "rooms":
      return <RoomsView />;
    case "guests":
      return <GuestsView />;
    case "frontdesk":
      return <FrontDeskView />;
    case "housekeeping":
      return <HousekeepingView />;
    case "payments":
      return <PaymentsView />;
    case "expenses":
      return <ExpensesView />;
    case "reports":
      return <RevenueReportView />;
    case "staff":
      return <StaffView />;
    case "settings":
      return <SettingsView />;
    case "platform_dashboard":
      return <PlatformDashboardView />;
    case "tenants":
      return <TenantsView />;
    case "platform_fees":
      return <PlatformFeesView />;
    case "platform_plans":
      return <PlatformPlansView />;
    case "platform_audit":
      return <PlatformAuditView />;
    default:
      return <DashboardView />;
  }
}

/**
 * Boots the session: calls /api/auth/me to hydrate the user from the
 * httpOnly cookie. Shows a loading splash until resolved.
 *
 * The rendered content (LoginScreen vs app shell) is derived purely from
 * `currentUser` in the store — LoginScreen sets it after login, Header
 * clears it after logout — so there's no separate auth-state to keep in sync.
 */
function SessionGate() {
  const setUser = useAppStore((s) => s.setUser);
  const setTenant = useAppStore((s) => s.setTenant);
  const setView = useAppStore((s) => s.setView);
  const currentUser = useAppStore((s) => s.currentUser);
  const isSuperAdmin = currentUser?.isSuperAdmin;
  // `booting` is only true during the very first /api/auth/me call.
  // It flips to false once the fetch resolves, and never goes back to true.
  const [booting, setBooting] = useState(true);

  // Sync view with URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) setView(hash as any);
    const handler = () => {
      const h = window.location.hash.replace("#", "");
      if (h) setView(h as any);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [setView]);

  // Hydrate the current user from the session cookie (runs once on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401 || !res.ok) {
          setUser(null);
          setBooting(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setUser({
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
          setTenant(data.tenant.id, data.tenant.name);
        }
        setBooting(false);
      } catch {
        if (!cancelled) {
          setUser(null);
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setTenant]);

  // Super admin should land on platform dashboard by default
  useEffect(() => {
    if (isSuperAdmin && currentUser) {
      const hash = window.location.hash.replace("#", "");
      if (!hash) setView("platform_dashboard");
    }
  }, [isSuperAdmin, currentUser, setView]);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading LodgeHub…</p>
        </div>
      </div>
    );
  }

  // Derive auth state directly from the store — no separate state to sync.
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border">
        <Sidebar />
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-x-hidden pb-20 lg:pb-6">
          <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
            <ActiveView />
          </div>
        </main>
      </div>
      <MobileNav />
      <QuickActions />
    </div>
  );
}

export default function Home() {
  return (
    <QueryProvider>
      <SessionGate />
    </QueryProvider>
  );
}
