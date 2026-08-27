import type {
  Room,
  Booking,
  Guest,
  Payment,
  Expense,
  HousekeepingTask,
  User,
  Invoice,
  AuditLog,
  Notification,
} from "./types";

export function formatRoom(r: any): Room {
  return {
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status,
    notes: r.notes,
    roomType: {
      id: r.roomType.id,
      name: r.roomType.name,
      description: r.roomType.description,
      basePrice: r.roomType.basePrice,
      capacity: r.roomType.capacity,
      extraBedPrice: r.roomType.extraBedPrice,
      amenities: safeParse(r.roomType.amenities, []),
    },
    property: r.property
      ? {
          id: r.property.id,
          name: r.property.name,
          address: r.property.address,
          city: r.property.city,
          phone: r.property.phone,
        }
      : {
          id: "",
          name: "",
          address: null,
          city: null,
          phone: null,
        },
  };
}

export function formatGuest(g: any): Guest {
  return {
    id: g.id,
    name: g.name,
    mobile: g.mobile,
    email: g.email,
    address: g.address,
    idType: g.idType,
    idNumber: g.idNumber,
    company: g.company,
    gstNumber: g.gstNumber,
    notes: g.notes,
    blacklisted: g.blacklisted,
    createdAt: g.createdAt,
  };
}

export function formatBooking(b: any): Booking {
  return {
    id: b.id,
    bookingCode: b.bookingCode,
    guest: formatGuest(b.guest),
    room: formatRoom(b.room),
    source: b.source,
    status: b.status,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    adults: b.adults,
    children: b.children,
    numGuests: b.numGuests,
    extraBed: b.extraBed,
    tariffPerDay: b.tariffPerDay,
    totalAmount: b.totalAmount,
    advancePaid: b.advancePaid,
    discount: b.discount,
    taxRate: b.taxRate,
    specialRequests: b.specialRequests,
    checkInActual: b.checkInActual,
    checkOutActual: b.checkOutActual,
    cancellationReason: b.cancellationReason,
    createdAt: b.createdAt,
    createdBy: b.createdBy ? formatUser(b.createdBy) : null,
    payments: b.payments ? b.payments.map(formatPayment) : undefined,
  };
}

export function formatPayment(p: any): Payment {
  return {
    id: p.id,
    bookingId: p.bookingId,
    guest: p.guest ? formatGuest(p.guest) : null,
    amount: p.amount,
    method: p.method,
    type: p.type,
    reference: p.reference,
    notes: p.notes,
    status: p.status,
    createdAt: p.createdAt,
    booking: p.booking ? undefined : undefined,
  };
}

export function formatExpense(e: any): Expense {
  return {
    id: e.id,
    category: e.category,
    amount: e.amount,
    description: e.description,
    method: e.method,
    date: e.date,
    receiptUrl: e.receiptUrl,
    user: e.user ? formatUser(e.user) : null,
  };
}

export function formatHousekeeping(h: any): HousekeepingTask {
  return {
    id: h.id,
    room: formatRoom(h.room),
    assignedTo: h.assignedTo ? h.assignedTo : null,
    status: h.status,
    priority: h.priority,
    notes: h.notes,
    createdAt: h.createdAt,
    completedAt: h.completedAt,
  };
}

export function formatUser(u: any): User {
  return {
    id: u.id,
    tenantId: u.tenantId,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    avatar: u.avatar,
    active: u.active,
    lastLogin: u.lastLogin,
    property: u.property
      ? {
          id: u.property.id,
          name: u.property.name,
          address: u.property.address,
          city: u.property.city,
          phone: u.property.phone,
        }
      : null,
  };
}

export function formatInvoice(inv: any): Invoice {
  return {
    id: inv.id,
    invoiceCode: inv.invoiceCode,
    bookingId: inv.bookingId,
    guest: formatGuest(inv.guest ?? inv.booking?.guest),
    subtotal: inv.subtotal,
    discount: inv.discount,
    taxAmount: inv.taxAmount,
    total: inv.total,
    paidAmount: inv.paidAmount,
    balance: inv.balance,
    status: inv.status,
    items: safeParse(inv.itemsJson, []),
    createdAt: inv.createdAt,
  };
}

export function formatAuditLog(a: any): AuditLog {
  return {
    id: a.id,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    details: a.details,
    createdAt: a.createdAt,
    user: a.user ? formatUser(a.user) : null,
  };
}

export function formatNotification(n: any): Notification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt,
  };
}

function safeParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== "string") return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}
