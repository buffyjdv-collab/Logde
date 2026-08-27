"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { QueryProvider } from "@/components/query-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
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
import { ReportsView } from "@/components/views/reports-view";
import { StaffView } from "@/components/views/staff-view";
import { SettingsView } from "@/components/views/settings-view";

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
      return <ReportsView />;
    case "staff":
      return <StaffView />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  const setView = useAppStore((s) => s.setView);

  // Sync view with URL hash for shareable state
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

  return (
    <QueryProvider>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border">
          <Sidebar />
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-x-hidden pb-20 lg:pb-6">
            <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
              <ActiveView />
            </div>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />

        {/* Quick action dialogs */}
        <QuickActions />
      </div>
    </QueryProvider>
  );
}
