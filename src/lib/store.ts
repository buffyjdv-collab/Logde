import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewKey, UserRole, Permission } from "./types";
import { NAV_PERMISSION_MAP } from "./permissions";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleId?: string;
  avatar: string | null;
  isSuperAdmin?: boolean;
  permissions: string[]; // permission keys
  menuItems: string[]; // nav item keys the user can see
}

interface AppState {
  tenantId: string;
  tenantName: string;
  currentUser: CurrentUser | null;
  activeView: ViewKey;
  quickAction: "new_booking" | "check_in" | "check_out" | "payment" | null;
  sidebarOpen: boolean;
  setTenant: (id: string, name: string) => void;
  setUser: (u: CurrentUser | null) => void;
  setView: (v: ViewKey) => void;
  setQuickAction: (a: AppState["quickAction"]) => void;
  setSidebarOpen: (open: boolean) => void;
  /** True if the user holds a permission key (or is super admin). */
  can: (permissionKey: string) => boolean;
  /** True if the user can see a nav item. */
  canSeeNav: (itemKey: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tenantId: "tenant_pinevalley",
      tenantName: "Pine Valley Lodge",
      currentUser: {
        id: "demo-owner",
        name: "Aditya Khanna",
        email: "owner@pinevalley.in",
        role: "owner",
        avatar: null,
        permissions: [],
        menuItems: [],
      },
      activeView: "dashboard",
      quickAction: null,
      sidebarOpen: false,
      setTenant: (id, name) => {
        set({ tenantId: id, tenantName: name });
        if (typeof window !== "undefined") {
          localStorage.setItem("lodgehub-tenant", id);
        }
      },
      setUser: (u) => {
        set({ currentUser: u });
        if (typeof window !== "undefined") {
          if (u) {
            localStorage.setItem("lodgehub-user-id", u.id);
          } else {
            localStorage.removeItem("lodgehub-user-id");
          }
        }
      },
      setView: (v) => set({ activeView: v, sidebarOpen: false }),
      setQuickAction: (a) => set({ quickAction: a }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      can: (permissionKey: string) => {
        const u = get().currentUser;
        if (!u) return false;
        if (u.isSuperAdmin) return true;
        return u.permissions.includes("*") || u.permissions.includes(permissionKey);
      },
      canSeeNav: (itemKey: string) => {
        const u = get().currentUser;
        if (!u) return false;
        if (u.isSuperAdmin) return true;
        // explicit menuItems assignment takes precedence
        if (u.menuItems.length > 0) return u.menuItems.includes(itemKey);
        // fallback: derive from permission map
        const required = NAV_PERMISSION_MAP[itemKey];
        if (!required) return false;
        return u.permissions.includes("*") || u.permissions.includes(required);
      },
    }),
    {
      name: "lodgehub-store",
      partialize: (s) => ({
        activeView: s.activeView,
        tenantId: s.tenantId,
        tenantName: s.tenantName,
        currentUser: s.currentUser,
      }),
    }
  )
);

// Legacy coarse permission helper (kept for backward compatibility)
export const can = (role: UserRole | undefined, action: string): boolean => {
  if (!role) return false;
  if (role === "super_admin" || role === "owner") return true;
  const permissions: Record<UserRole, string[]> = {
    super_admin: ["*"],
    owner: ["*"],
    manager: [
      "dashboard", "bookings", "rooms", "guests", "frontdesk", "housekeeping",
      "payments", "expenses", "reports", "staff", "settings",
    ],
    receptionist: ["dashboard", "bookings", "rooms", "guests", "frontdesk", "payments"],
    housekeeping: ["dashboard", "rooms", "housekeeping"],
    accountant: ["dashboard", "payments", "expenses", "reports"],
  };
  const allowed = permissions[role] || [];
  return allowed.includes(action) || allowed.includes("*");
};
