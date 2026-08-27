// LodgeHub — TypeScript types (mirror of Prisma models with JSON-parsed fields)

export type RoomStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "cleaning"
  | "maintenance"
  | "blocked";

export type BookingStatus =
  | "confirmed"
  | "pending"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type PaymentMethod = "cash" | "upi" | "card" | "bank_transfer";
export type PaymentType =
  | "advance"
  | "room"
  | "food"
  | "extra_bed"
  | "other"
  | "balance"
  | "refund";

export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "receptionist"
  | "housekeeping"
  | "accountant";

export type HousekeepingStatus =
  | "pending"
  | "in_progress"
  | "inspection"
  | "done"
  | "blocked";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  plan: string;
  status: string;
  currency: string;
  timezone: string;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  lastLogin: string | null;
  property?: Property | null;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  capacity: number;
  extraBedPrice: number;
  amenities: string[];
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  roomType: RoomType;
  property: Property;
}

export interface Guest {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  idType: string | null;
  idNumber: string | null;
  company: string | null;
  gstNumber: string | null;
  notes: string | null;
  blacklisted: boolean;
  createdAt: string;
  bookingsCount?: number;
  totalSpent?: number;
  lastStay?: string | null;
}

export interface Booking {
  id: string;
  bookingCode: string;
  guest: Guest;
  room: Room;
  source: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  numGuests: number;
  extraBed: boolean;
  tariffPerDay: number;
  totalAmount: number;
  advancePaid: number;
  discount: number;
  taxRate: number;
  specialRequests: string | null;
  checkInActual: string | null;
  checkOutActual: string | null;
  cancellationReason: string | null;
  createdAt: string;
  createdBy?: User | null;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  bookingId: string | null;
  guest?: Guest | null;
  amount: number;
  method: PaymentMethod;
  type: PaymentType;
  reference: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  booking?: Booking | null;
}

export interface InvoiceItem {
  label: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceCode: string;
  bookingId: string;
  guest: Guest;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: string;
  items: InvoiceItem[];
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  method: string;
  date: string;
  receiptUrl: string | null;
  user?: User | null;
}

export interface HousekeepingTask {
  id: string;
  room: Room;
  assignedTo?: User | null;
  status: HousekeepingStatus;
  priority: string;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user?: User | null;
}

export interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  reservedRooms: number;
  cleaningRooms: number;
  maintenanceRooms: number;
  blockedRooms: number;
  checkInsToday: number;
  checkOutsToday: number;
  todayRevenue: number;
  pendingPayments: number;
  occupancyRate: number;
  totalGuests: number;
  activeBookings: number;
  arrivals: Booking[];
  departures: Booking[];
  recentBookings: Booking[];
  revenueTrend: { date: string; revenue: number; expenses: number }[];
  roomStatusBreakdown: { name: string; value: number; status: string }[];
  occupancyByFloor: { floor: number; total: number; occupied: number }[];
}

export interface ReportData {
  dailyRevenue: { date: string; revenue: number; bookings: number }[];
  monthlyRevenue: { month: string; revenue: number; expenses: number }[];
  occupancyTrend: { date: string; rate: number }[];
  paymentMethodBreakdown: { method: string; amount: number; count: number }[];
  topRooms: { roomNumber: string; bookings: number; revenue: number }[];
  expenseBreakdown: { category: string; amount: number }[];
  outstandingPayments: {
    bookingCode: string;
    guestName: string;
    roomNumber: string;
    balance: number;
    checkOut: string;
  }[];
  totals: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    totalBookings: number;
    avgOccupancy: number;
  };
}

export type ViewKey =
  | "dashboard"
  | "bookings"
  | "rooms"
  | "guests"
  | "frontdesk"
  | "housekeeping"
  | "payments"
  | "expenses"
  | "reports"
  | "staff"
  | "settings";
