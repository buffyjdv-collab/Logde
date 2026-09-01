// LodgeHub — constants, enums, and helpers

export const ROOM_STATUS = {
  available: { label: "Available", color: "emerald", dot: "bg-emerald-500" },
  occupied: { label: "Occupied", color: "rose", dot: "bg-rose-500" },
  reserved: { label: "Reserved", color: "amber", dot: "bg-amber-500" },
  cleaning: { label: "Cleaning", color: "sky", dot: "bg-sky-500" },
  maintenance: { label: "Maintenance", color: "orange", dot: "bg-orange-500" },
  blocked: { label: "Blocked", color: "zinc", dot: "bg-zinc-500" },
} as const;

export const BOOKING_STATUS = {
  confirmed: { label: "Confirmed", color: "emerald" },
  pending: { label: "Pending", color: "amber" },
  checked_in: { label: "Checked-In", color: "sky" },
  checked_out: { label: "Checked-Out", color: "zinc" },
  cancelled: { label: "Cancelled", color: "rose" },
  no_show: { label: "No-Show", color: "orange" },
} as const;

export const PAYMENT_METHOD = {
  cash: { label: "Cash", color: "emerald" },
  upi: { label: "UPI", color: "sky" },
  card: { label: "Card", color: "violet" },
  bank_transfer: { label: "Bank Transfer", color: "amber" },
} as const;

export const PAYMENT_TYPE = {
  advance: "Advance",
  room: "Room Charges",
  food: "Food & Service",
  extra_bed: "Extra Bed",
  other: "Other Charges",
  balance: "Balance Payment",
  refund: "Refund",
} as const;

export const EXPENSE_CATEGORIES = {
  utilities: { label: "Utilities", color: "sky" },
  salaries: { label: "Salaries", color: "violet" },
  supplies: { label: "Supplies", color: "emerald" },
  maintenance: { label: "Maintenance", color: "orange" },
  marketing: { label: "Marketing", color: "pink" },
  food: { label: "Food & Beverage", color: "amber" },
  misc: { label: "Miscellaneous", color: "zinc" },
} as const;

export const USER_ROLES = {
  super_admin: { label: "Super Admin", color: "rose" },
  owner: { label: "Owner", color: "emerald" },
  manager: { label: "Manager", color: "sky" },
  receptionist: { label: "Receptionist", color: "amber" },
  housekeeping: { label: "Housekeeping", color: "violet" },
  accountant: { label: "Accountant", color: "teal" },
} as const;

export const HOUSEKEEPING_STATUS = {
  pending: { label: "To Clean", color: "amber" },
  in_progress: { label: "In Progress", color: "sky" },
  inspection: { label: "Inspection", color: "violet" },
  done: { label: "Done", color: "emerald" },
  blocked: { label: "Blocked", color: "zinc" },
} as const;

export const BOOKING_SOURCES = {
  walk_in: "Walk-in",
  online: "Online",
  phone: "Phone",
  agent: "Agent",
} as const;

export const ID_TYPES = {
  aadhaar: "Aadhaar Card",
  passport: "Passport",
  driving_license: "Driving License",
  pan: "PAN Card",
  voter: "Voter ID",
} as const;

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "bookings", label: "Bookings", icon: "CalendarCheck" },
  { key: "rooms", label: "Rooms", icon: "BedDouble" },
  { key: "guests", label: "Guests", icon: "Users" },
  { key: "frontdesk", label: "Front Desk", icon: "ConciergeBell" },
  { key: "housekeeping", label: "Housekeeping", icon: "Sparkles" },
  { key: "payments", label: "Payments", icon: "ReceiptIndianRupee" },
  { key: "expenses", label: "Expenses", icon: "Wallet" },
  { key: "reports", label: "Reports", icon: "Table2" },
  { key: "staff", label: "Staff", icon: "IdCard" },
  { key: "settings", label: "Settings", icon: "Settings" },
] as const;

export const SUPER_ADMIN_NAV = [
  { key: "platform_dashboard", label: "Platform Overview", icon: "ShieldCheck" },
  { key: "tenants", label: "Tenants", icon: "Building2" },
  { key: "platform_fees", label: "Platform Fees", icon: "Percent" },
  { key: "platform_plans", label: "Subscription Plans", icon: "Crown" },
  { key: "platform_audit", label: "Audit Logs", icon: "ScrollText" },
] as const;

export const AMENITY_OPTIONS = [
  "Wi-Fi",
  "AC",
  "TV",
  "Hot Water",
  "Mini Fridge",
  "Balcony",
  "Room Heater",
  "Safe Locker",
  "Tea/Coffee Maker",
  "Mountain View",
  "Breakfast Included",
  "Parking",
];

export const EXPENSE_DISTRIBUTION = [
  { key: "salaries", limit: 80000 },
  { key: "utilities", limit: 25000 },
  { key: "supplies", limit: 18000 },
  { key: "maintenance", limit: 15000 },
  { key: "food", limit: 40000 },
  { key: "marketing", limit: 12000 },
  { key: "misc", limit: 8000 },
];

// Color class maps (kept here for quick badge rendering)
export const BADGE_COLOR: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20",
  },
  sky: {
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-500/20",
  },
  orange: {
    bg: "bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-500/20",
  },
  zinc: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-400",
    border: "border-zinc-500/20",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-500/20",
  },
  teal: {
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-500/20",
  },
  pink: {
    bg: "bg-pink-500/10",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-500/20",
  },
};

export const formatCurrency = (amount: number, currency = "INR") => {
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "₹";
  return `${symbol}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (date: Date | string | null | undefined, withTime = false) => {
  if (date === null || date === undefined || date === "") return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  if (withTime) {
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const daysBetween = (a: Date | string, b: Date | string) => {
  const d1 = typeof a === "string" ? new Date(a) : a;
  const d2 = typeof b === "string" ? new Date(b) : b;
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
};
