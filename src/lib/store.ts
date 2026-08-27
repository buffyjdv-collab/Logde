import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewKey, UserRole } from "./types";

interface AppState {
  // Active tenant (single-tenant demo, but structured for multi-tenant)
  tenantId: string;
  tenantName: string;
  // Current user (simulated auth for demo)
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar: string | null;
  } | null;
  // Navigation
  activeView: ViewKey;
  // Quick-action modal control
  quickAction: "new_booking" | "check_in" | "check_out" | "payment" | null;
  // Sidebar (mobile)
  sidebarOpen: boolean;
  setTenant: (id: string, name: string) => void;
  setUser: (u: AppState["currentUser"]) => void;
  setView: (v: ViewKey) => void;
  setQuickAction: (a: AppState["quickAction"]) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tenantId: "tenant_pinevalley",
      tenantName: "Pine Valley Lodge",
      currentUser: {
        id: "demo-owner",
        name: "Aditya Khanna",
        email: "owner@pinevalley.in",
        role: "owner",
        avatar: null,
      },
      activeView: "dashboard",
      quickAction: null,
      sidebarOpen: false,
      setTenant: (id, name) => set({ tenantId: id, tenantName: name }),
      setUser: (u) => set({ currentUser: u }),
      setView: (v) => set({ activeView: v, sidebarOpen: false }),
      setQuickAction: (a) => set({ quickAction: a }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: "lodgehub-store",
      partialize: (s) => ({ activeView: s.activeView }),
    }
  )
);

// Role-based permission helper
export const can = (role: UserRole | undefined, action: string): boolean => {
  if (!role) return false;
  if (role === "super_admin" || role === "owner") return true;
  const permissions: Record<UserRole, string[]> = {
    super_admin: ["*"],
    owner: ["*"],
    manager: [
      "dashboard",
      "bookings",
      "rooms",
      "guests",
      "frontdesk",
      "housekeeping",
      "payments",
      "expenses",
      "reports",
      "staff",
      "settings",
    ],
    receptionist: [
      "dashboard",
      "bookings",
      "rooms",
      "guests",
      "frontdesk",
      "payments",
    ],
    housekeeping: ["dashboard", "rooms", "housekeeping"],
    accountant: ["dashboard", "payments", "expenses", "reports"],
  };
  const allowed = permissions[role] || [];
  return allowed.includes(action) || allowed.includes("*");
};
