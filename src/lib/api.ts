import type {
  DashboardStats,
  ReportData,
  Room,
  Booking,
  Guest,
  Payment,
  Expense,
  HousekeepingTask,
  Notification,
  User,
  Invoice,
  AuditLog,
  Role,
  Permission,
  Tenant,
  PlatformFeeConfig,
  PlatformFeePayment,
  PlatformDashboard,
  RevenueReport,
} from "./types";

const TENANT_HEADER = "x-tenant-id";

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const tenant = localStorage.getItem("lodgehub-tenant");
    if (tenant) h[TENANT_HEADER] = tenant;
  }
  return h;
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include", // send httpOnly cookies
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api<{
      id: string;
      name: string;
      email: string;
      role: string;
      roleId: string | null;
      avatar: string | null;
      isSuperAdmin: boolean;
      permissions: string[];
      menuItems: string[];
      tenant: { id: string; name: string; slug: string; plan: string; status: string; currency: string } | null;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    api<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () =>
    api<{
      id: string;
      name: string;
      email: string;
      role: string;
      roleId: string | null;
      avatar: string | null;
      isSuperAdmin: boolean;
      permissions: string[];
      menuItems: string[];
      tenant: { id: string; name: string; slug: string; plan: string; status: string; currency: string } | null;
    }>("/api/auth/me"),
};

// Dashboard
export const dashboardApi = {
  get: () => api<DashboardStats>("/api/dashboard"),
};

// Rooms
export const roomsApi = {
  list: (status?: string) =>
    api<Room[]>(`/api/rooms${status ? `?status=${status}` : ""}`),
  update: (id: string, data: Partial<Room>) =>
    api<Room>(`/api/rooms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Bookings
export const bookingsApi = {
  list: (params?: { status?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    return api<Booking[]>(`/api/bookings${q.toString() ? `?${q}` : ""}`);
  },
  get: (id: string) => api<Booking>(`/api/bookings/${id}`),
  create: (data: Record<string, unknown>) =>
    api<Booking>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    api<Booking>(`/api/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  checkIn: (id: string) =>
    api<Booking>(`/api/bookings/${id}/checkin`, { method: "POST" }),
  checkOut: (id: string, data?: { extraCharges?: { label: string; amount: number }[] }) =>
    api<{ booking: Booking; invoice: Invoice }>(`/api/bookings/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  cancel: (id: string, reason: string) =>
    api<Booking>(`/api/bookings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// Guests
export const guestsApi = {
  list: (search?: string) =>
    api<Guest[]>(`/api/guests${search ? `?q=${encodeURIComponent(search)}` : ""}`),
  get: (id: string) => api<Guest & { bookings: Booking[]; payments: Payment[] }>(`/api/guests/${id}`),
  create: (data: Record<string, unknown>) =>
    api<Guest>("/api/guests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    api<Guest>(`/api/guests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Payments
export const paymentsApi = {
  list: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    return api<Payment[]>(`/api/payments${q.toString() ? `?${q}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    api<Payment>("/api/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Invoices
export const invoicesApi = {
  get: (id: string) => api<Invoice>(`/api/invoices/${id}`),
};

// Expenses
export const expensesApi = {
  list: (params?: { from?: string; to?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    if (params?.category) q.set("category", params.category);
    return api<Expense[]>(`/api/expenses${q.toString() ? `?${q}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    api<Expense>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/api/expenses/${id}`, { method: "DELETE" }),
};

// Housekeeping
export const housekeepingApi = {
  list: (status?: string) =>
    api<HousekeepingTask[]>(
      `/api/housekeeping${status ? `?status=${status}` : ""}`
    ),
  update: (id: string, data: Record<string, unknown>) =>
    api<HousekeepingTask>(`/api/housekeeping/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Staff
export const staffApi = {
  list: () => api<User[]>("/api/staff"),
  create: (data: Record<string, unknown>) =>
    api<User>("/api/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    api<User>(`/api/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Reports
export const reportsApi = {
  get: (range: "7d" | "30d" | "90d" | "1y" = "30d") =>
    api<ReportData>(`/api/reports?range=${range}`),
  revenue: (range: "7d" | "30d" | "90d" | "1y" = "30d") =>
    api<RevenueReport>(`/api/reports/revenue?range=${range}`),
};

// Notifications
export const notificationsApi = {
  list: () => api<Notification[]>("/api/notifications"),
  markRead: (id: string) =>
    api<Notification>(`/api/notifications/${id}`, { method: "PATCH" }),
  markAllRead: () =>
    api<{ success: boolean }>("/api/notifications", { method: "PATCH" }),
};

// Audit logs
export const auditApi = {
  list: () => api<AuditLog[]>("/api/audit"),
};

// ── RBAC: Roles, Permissions, Users with roles ──────────────────────────────
export const permissionsApi = {
  list: () => api<Permission[]>("/api/permissions"),
};

export const rolesApi = {
  list: () => api<Role[]>("/api/roles"),
  create: (data: { name: string; label: string; description?: string; permissionKeys: string[]; menuItems: string[] }) =>
    api<Role>("/api/roles", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { label?: string; description?: string; permissionKeys?: string[]; menuItems?: string[] }) =>
    api<Role>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/api/roles/${id}`, { method: "DELETE" }),
};

export const usersRbacApi = {
  list: () => api<User[]>("/api/staff"),
  assignRole: (userId: string, roleId: string) =>
    api<User>(`/api/staff/${userId}/role`, { method: "PATCH", body: JSON.stringify({ roleId }) }),
};

// ── Super Admin: Tenants ────────────────────────────────────────────────────
export const tenantsApi = {
  list: () => api<Tenant[]>("/api/super/tenants"),
  get: (id: string) => api<Tenant & { owner: { id: string; name: string; email: string; phone: string | null; active: boolean; lastLogin: string | null } | null }>(`/api/super/tenants/${id}`),
  create: (data: { name: string; contactEmail: string; contactPhone?: string; address?: string; plan?: string; feeType?: string; feeValue?: number; ownerName?: string; ownerEmail?: string; password?: string }) =>
    api<Tenant & { credentials: { ownerName: string; email: string; password: string; userId: string; loginUrl: string } }>("/api/super/tenants", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Tenant>) =>
    api<Tenant>(`/api/super/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  resetPassword: (id: string, password?: string) =>
    api<{ ownerName: string; email: string; password: string; message: string }>(`/api/super/tenants/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
};

// ── Super Admin: Platform Fees ───────────────────────────────────────────────
export const platformFeesApi = {
  configs: () => api<(PlatformFeeConfig & { tenant: Tenant })[]>("/api/super/platform-fees"),
  updateConfig: (tenantId: string, data: { feeType?: string; feeValue?: number; active?: boolean; notes?: string }) =>
    api<PlatformFeeConfig>(`/api/super/platform-fees/${tenantId}`, { method: "PATCH", body: JSON.stringify(data) }),
  payments: () => api<(PlatformFeePayment & { tenant: Tenant })[]>("/api/super/platform-fee-payments"),
  recordPayment: (id: string, data: { amount: number; method: string; reference?: string }) =>
    api<PlatformFeePayment>(`/api/super/platform-fee-payments/${id}/pay`, { method: "POST", body: JSON.stringify(data) }),
};

// ── Super Admin: Dashboard ──────────────────────────────────────────────────
export const superDashboardApi = {
  get: () => api<PlatformDashboard>("/api/super/dashboard"),
};
