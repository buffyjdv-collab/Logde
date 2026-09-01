// LodgeHub — Molecular Permission Catalog
//
// Each permission is a granular capability: `module.action`.
// Each sidebar nav item declares the permission key required to see it.
// Roles are bundles of permission keys (+ assigned menu items).
// Super Admin automatically holds every permission + all menu items.

export interface PermissionDef {
  key: string;
  module: string;
  action: string;
  label: string;
  description?: string;
  isSuperAdmin?: boolean;
}

// Every molecular permission in the system
export const PERMISSION_CATALOG: PermissionDef[] = [
  // Dashboard
  { key: "dashboard.view", module: "dashboard", action: "view", label: "View Dashboard", description: "Access the main dashboard" },

  // Bookings
  { key: "bookings.view", module: "bookings", action: "view", label: "View Bookings", description: "See the bookings list & calendar" },
  { key: "bookings.create", module: "bookings", action: "create", label: "Create Booking", description: "Create new reservations" },
  { key: "bookings.edit", module: "bookings", action: "edit", label: "Edit Booking", description: "Modify existing bookings" },
  { key: "bookings.checkin", module: "bookings", action: "checkin", label: "Check-In", description: "Check guests into rooms" },
  { key: "bookings.checkout", module: "bookings", action: "checkout", label: "Check-Out", description: "Check guests out & generate invoices" },
  { key: "bookings.cancel", module: "bookings", action: "cancel", label: "Cancel Booking", description: "Cancel reservations" },

  // Rooms
  { key: "rooms.view", module: "rooms", action: "view", label: "View Rooms", description: "See the room grid" },
  { key: "rooms.edit_status", module: "rooms", action: "edit_status", label: "Change Room Status", description: "Update room availability status" },
  { key: "rooms.manage", module: "rooms", action: "manage", label: "Manage Rooms", description: "Add/edit/delete rooms & room types" },

  // Guests
  { key: "guests.view", module: "guests", action: "view", label: "View Guests", description: "See guest profiles & history" },
  { key: "guests.create", module: "guests", action: "create", label: "Create Guest", description: "Add new guest profiles" },
  { key: "guests.edit", module: "guests", action: "edit", label: "Edit Guest", description: "Modify guest information" },

  // Front Desk
  { key: "frontdesk.view", module: "frontdesk", action: "view", label: "Front Desk", description: "Access the reception workflow" },

  // Housekeeping
  { key: "housekeeping.view", module: "housekeeping", action: "view", label: "View Housekeeping", description: "See the cleaning task board" },
  { key: "housekeeping.update", module: "housekeeping", action: "update", label: "Update Tasks", description: "Move housekeeping tasks" },

  // Payments
  { key: "payments.view", module: "payments", action: "view", label: "View Payments", description: "See transactions & invoices" },
  { key: "payments.create", module: "payments", action: "create", label: "Record Payment", description: "Collect payments from guests" },
  { key: "payments.refund", module: "payments", action: "refund", label: "Issue Refund", description: "Process refunds" },

  // Expenses
  { key: "expenses.view", module: "expenses", action: "view", label: "View Expenses", description: "See expense records" },
  { key: "expenses.create", module: "expenses", action: "create", label: "Create Expense", description: "Record new expenses" },
  { key: "expenses.delete", module: "expenses", action: "delete", label: "Delete Expense", description: "Remove expense records" },

  // Reports
  { key: "reports.view", module: "reports", action: "view", label: "View Reports", description: "Access revenue & performance reports" },
  { key: "reports.export", module: "reports", action: "export", label: "Export Reports", description: "Download CSV / PDF reports" },

  // Staff & Roles
  { key: "staff.view", module: "staff", action: "view", label: "View Staff", description: "See team members" },
  { key: "staff.manage", module: "staff", action: "manage", label: "Manage Staff", description: "Add/edit/deactivate users" },
  { key: "staff.manage_roles", module: "staff", action: "manage_roles", label: "Manage Roles", description: "Configure roles & assign permissions" },

  // Settings
  { key: "settings.view", module: "settings", action: "view", label: "View Settings", description: "See lodge settings" },
  { key: "settings.manage", module: "settings", action: "manage", label: "Manage Settings", description: "Edit lodge profile & preferences" },

  // ── Super Admin (platform-level) permissions ──
  { key: "platform.dashboard", module: "platform", action: "dashboard", label: "Platform Dashboard", description: "View super admin overview", isSuperAdmin: true },
  { key: "tenants.view", module: "tenants", action: "view", label: "View Tenants", description: "See all tenant businesses", isSuperAdmin: true },
  { key: "tenants.create", module: "tenants", action: "create", label: "Create Tenant", description: "Onboard new lodges", isSuperAdmin: true },
  { key: "tenants.manage", module: "tenants", action: "manage", label: "Manage Tenants", description: "Edit/suspend/cancel tenants", isSuperAdmin: true },
  { key: "platform.fees_config", module: "platform", action: "fees_config", label: "Configure Platform Fees", description: "Set per-tenant fee policy", isSuperAdmin: true },
  { key: "platform.fees_collect", module: "platform", action: "fees_collect", label: "Collect Platform Fees", description: "Record fee payments from tenants", isSuperAdmin: true },
  { key: "platform.plans", module: "platform", action: "plans", label: "Manage Plans", description: "Configure subscription plans", isSuperAdmin: true },
  { key: "platform.audit", module: "platform", action: "audit", label: "Platform Audit Logs", description: "View cross-tenant audit trail", isSuperAdmin: true },
];

export const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

// Map of module → permissions (for the role builder UI grouping)
export const PERMISSION_GROUPS = PERMISSION_CATALOG.reduce(
  (acc, p) => {
    (acc[p.module] = acc[p.module] || []).push(p);
    return acc;
  },
  {} as Record<string, PermissionDef[]>
);

// Nav item → required permission key mapping
export const NAV_PERMISSION_MAP: Record<string, string> = {
  dashboard: "dashboard.view",
  bookings: "bookings.view",
  rooms: "rooms.view",
  guests: "guests.view",
  frontdesk: "frontdesk.view",
  housekeeping: "housekeeping.view",
  payments: "payments.view",
  expenses: "expenses.view",
  reports: "reports.view",
  staff: "staff.view",
  settings: "settings.view",
  // Super Admin nav
  platform_dashboard: "platform.dashboard",
  tenants: "tenants.view",
  platform_fees: "platform.fees_config",
  platform_plans: "platform.plans",
  platform_audit: "platform.audit",
};

// Default role → permission key sets (used during seeding & role creation)
export const DEFAULT_ROLE_PERMISSIONS: Record<
  string,
  { label: string; description: string; isSystem?: boolean; isSuperAdmin?: boolean; permissions: string[]; menuItems: string[] }
> = {
  super_admin: {
    label: "Super Admin",
    description: "Full platform control — manages tenants, platform fees, plans & audit.",
    isSystem: true,
    isSuperAdmin: true,
    permissions: PERMISSION_KEYS, // everything
    menuItems: [
      "dashboard", "bookings", "rooms", "guests", "frontdesk", "housekeeping",
      "payments", "expenses", "reports", "staff", "settings",
      "platform_dashboard", "tenants", "platform_fees", "platform_plans", "platform_audit",
    ],
  },
  owner: {
    label: "Lodge Owner",
    description: "Full control of the lodge — every module & setting.",
    isSystem: true,
    permissions: PERMISSION_KEYS.filter((k) => !PERMISSION_CATALOG.find((p) => p.key === k)?.isSuperAdmin),
    menuItems: [
      "dashboard", "bookings", "rooms", "guests", "frontdesk", "housekeeping",
      "payments", "expenses", "reports", "staff", "settings",
    ],
  },
  manager: {
    label: "Manager",
    description: "Manages day-to-day operations, staff & reports.",
    isSystem: true,
    permissions: [
      "dashboard.view", "bookings.view", "bookings.create", "bookings.edit", "bookings.checkin", "bookings.checkout", "bookings.cancel",
      "rooms.view", "rooms.edit_status", "rooms.manage",
      "guests.view", "guests.create", "guests.edit",
      "frontdesk.view",
      "housekeeping.view", "housekeeping.update",
      "payments.view", "payments.create",
      "expenses.view", "expenses.create", "expenses.delete",
      "reports.view", "reports.export",
      "staff.view", "staff.manage",
      "settings.view",
    ],
    menuItems: [
      "dashboard", "bookings", "rooms", "guests", "frontdesk", "housekeeping",
      "payments", "expenses", "reports", "staff", "settings",
    ],
  },
  receptionist: {
    label: "Receptionist",
    description: "Handles bookings, guests & front desk operations.",
    isSystem: true,
    permissions: [
      "dashboard.view", "bookings.view", "bookings.create", "bookings.edit", "bookings.checkin", "bookings.checkout",
      "rooms.view", "rooms.edit_status",
      "guests.view", "guests.create", "guests.edit",
      "frontdesk.view",
      "housekeeping.view",
      "payments.view", "payments.create",
    ],
    menuItems: ["dashboard", "bookings", "rooms", "guests", "frontdesk", "payments"],
  },
  housekeeping: {
    label: "Housekeeping",
    description: "Cleans & maintains rooms.",
    isSystem: true,
    permissions: ["dashboard.view", "rooms.view", "housekeeping.view", "housekeeping.update"],
    menuItems: ["dashboard", "rooms", "housekeeping"],
  },
  accountant: {
    label: "Accountant",
    description: "Handles payments, expenses & financial reports.",
    isSystem: true,
    permissions: [
      "dashboard.view", "payments.view", "payments.create", "payments.refund",
      "expenses.view", "expenses.create", "expenses.delete",
      "reports.view", "reports.export", "bookings.view", "guests.view",
    ],
    menuItems: ["dashboard", "payments", "expenses", "reports"],
  },
};
