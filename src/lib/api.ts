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
} from "./types";

const TENANT_HEADER = "x-tenant-id";

function getTenantId(): string {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("lodgehub-tenant") || "tenant_pinevalley"
    );
  }
  return "tenant_pinevalley";
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      [TENANT_HEADER]: getTenantId(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

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
