// LodgeHub — seed script
// Run with: bun prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import {
  PERMISSION_CATALOG,
  DEFAULT_ROLE_PERMISSIONS,
} from "../src/lib/permissions";

const db = new PrismaClient();

const TENANT_ID = "tenant_pinevalley";
const PROPERTY_ID = "prop_main";
const ROOM_TYPES = [
  { id: "rt_standard", name: "Standard Room", basePrice: 1800, capacity: 2, extraBedPrice: 300, amenities: ["Wi-Fi", "AC", "TV", "Hot Water"] },
  { id: "rt_deluxe", name: "Deluxe Room", basePrice: 2800, capacity: 2, extraBedPrice: 400, amenities: ["Wi-Fi", "AC", "TV", "Hot Water", "Mini Fridge", "Tea/Coffee Maker", "Breakfast Included"] },
  { id: "rt_suite", name: "Executive Suite", basePrice: 4500, capacity: 3, extraBedPrice: 500, amenities: ["Wi-Fi", "AC", "TV", "Hot Water", "Mini Fridge", "Balcony", "Safe Locker", "Tea/Coffee Maker", "Mountain View", "Breakfast Included"] },
  { id: "rt_family", name: "Family Room", basePrice: 3600, capacity: 4, extraBedPrice: 400, amenities: ["Wi-Fi", "AC", "TV", "Hot Water", "Mini Fridge", "Tea/Coffee Maker", "Breakfast Included", "Parking"] },
];

const GUEST_SEED = [
  { name: "Rohan Mehta", mobile: "9876543210", email: "rohan.mehta@example.com", city: "Mumbai" },
  { name: "Priya Sharma", mobile: "9820012345", email: "priya.sharma@example.com", city: "Delhi" },
  { name: "Arjun Nair", mobile: "9988776655", email: "arjun.nair@example.com", city: "Bengaluru" },
  { name: "Sneha Reddy", mobile: "9001234567", email: "sneha.reddy@example.com", city: "Hyderabad" },
  { name: "Vikram Singh", mobile: "9090909090", email: "vikram.singh@example.com", city: "Jaipur" },
  { name: "Ananya Iyer", mobile: "8877665544", email: "ananya.iyer@example.com", city: "Chennai" },
  { name: "Karan Malhotra", mobile: "9123456780", email: "karan.m@example.com", city: "Pune" },
  { name: "Divya Kapoor", mobile: "9333445566", email: "divya.k@example.com", city: "Chandigarh" },
  { name: "Aditya Verma", mobile: "9445566778", email: "aditya.v@example.com", city: "Lucknow" },
  { name: "Meera Joshi", mobile: "9556677889", email: "meera.j@example.com", city: "Ahmedabad" },
  { name: "Rahul Gupta", mobile: "9667788990", email: "rahul.g@example.com", city: "Kolkata" },
  { name: "Pooja Desai", mobile: "9778899001", email: "pooja.d@example.com", city: "Surat" },
  { name: "Sanjay Rao", mobile: "9889900112", email: "sanjay.r@example.com", city: "Coimbatore" },
  { name: "Nisha Agarwal", mobile: "9990011223", email: "nisha.a@example.com", city: "Indore" },
  { name: "Ashwin Pillai", mobile: "9001122334", email: "ashwin.p@example.com", city: "Kochi" },
];

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

function genCode(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

function lastMonthKey(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  console.log("Seeding LodgeHub database...");

  // Clean
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.housekeepingTask.deleteMany();
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.expense.deleteMany();
  await db.booking.deleteMany();
  await db.room.deleteMany();
  await db.roomType.deleteMany();
  await db.guest.deleteMany();
  await db.rolePermission.deleteMany();
  await db.role.deleteMany();
  await db.permission.deleteMany();
  await db.platformFeePayment.deleteMany();
  await db.platformFeeConfig.deleteMany();
  await db.user.deleteMany();
  await db.tenantSubscription.deleteMany();
  await db.subscriptionPlan.deleteMany();
  await db.property.deleteMany();
  await db.tenant.deleteMany();

  // ── Permissions catalog ────────────────────────────────────────────────
  const permById: Record<string, string> = {};
  for (const p of PERMISSION_CATALOG) {
    const created = await db.permission.create({
      data: {
        key: p.key,
        module: p.module,
        action: p.action,
        label: p.label,
        description: p.description,
        isSuperAdmin: p.isSuperAdmin ?? false,
      },
    });
    permById[p.key] = created.id;
  }

  // ── Platform tenant + Super Admin user ────────────────────────────────
  const platformTenant = await db.tenant.create({
    data: {
      id: "tenant_platform",
      name: "LodgeHub Platform",
      slug: "platform",
      contactEmail: "superadmin@lodgehub.app",
      contactPhone: "9000000000",
      plan: "enterprise",
      status: "active",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });

  // Super Admin role (system, no tenant)
  const superAdminRole = await db.role.create({
    data: {
      tenantId: null,
      name: "super_admin",
      label: "Super Admin",
      description: "Full platform control — manages tenants, platform fees, plans & audit.",
      isSystem: true,
      isSuperAdmin: true,
      menuItems: JSON.stringify(DEFAULT_ROLE_PERMISSIONS.super_admin.menuItems),
    },
  });
  for (const key of DEFAULT_ROLE_PERMISSIONS.super_admin.permissions) {
    if (permById[key]) {
      await db.rolePermission.create({
        data: { roleId: superAdminRole.id, permissionId: permById[key] },
      });
    }
  }
  // Super Admin user
  await db.user.create({
    data: {
      id: "user_superadmin",
      tenantId: platformTenant.id,
      name: "Platform Super Admin",
      email: "superadmin@lodgehub.app",
      password: "hashed_demo_password",
      role: "super_admin",
      roleId: superAdminRole.id,
      phone: "9000000000",
    },
  });

  // Tenant
  const tenant = await db.tenant.create({
    data: {
      id: TENANT_ID,
      name: "Pine Valley Lodge",
      slug: "pine-valley",
      contactEmail: "admin@pinevalley.in",
      contactPhone: "911234567890",
      address: "Forest Road, Manali, Himachal Pradesh 175131",
      plan: "growth",
      status: "active",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });

  // Property
  const property = await db.property.create({
    data: {
      id: PROPERTY_ID,
      tenantId: tenant.id,
      name: "Pine Valley — Main",
      address: "Forest Road, Manali",
      city: "Manali",
      phone: "911234567890",
    },
  });

  // Users / Staff
  const staff = [
    { name: "Aditya Khanna", email: "owner@pinevalley.in", role: "owner" },
    { name: "Neha Bhatia", email: "manager@pinevalley.in", role: "manager" },
    { name: "Kabir Shah", email: "reception@pinevalley.in", role: "receptionist" },
    { name: "Sara Thomas", email: "reception2@pinevalley.in", role: "receptionist" },
    { name: "Gaurav Patil", email: "housekeeping@pinevalley.in", role: "housekeeping" },
    { name: "Lakshmi Menon", email: "accounts@pinevalley.in", role: "accountant" },
  ];

  // Create tenant-scoped system roles + assign permissions
  const roleByRoleName: Record<string, string> = {};
  for (const [roleName, cfg] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (roleName === "super_admin") continue; // already created globally
    const role = await db.role.create({
      data: {
        tenantId: tenant.id,
        name: roleName,
        label: cfg.label,
        description: cfg.description,
        isSystem: cfg.isSystem ?? false,
        isSuperAdmin: false,
        menuItems: JSON.stringify(cfg.menuItems),
      },
    });
    roleByRoleName[roleName] = role.id;
    for (const key of cfg.permissions) {
      if (permById[key]) {
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: permById[key] },
        });
      }
    }
  }

  for (const s of staff) {
    await db.user.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        name: s.name,
        email: s.email,
        password: "hashed_demo_password",
        role: s.role,
        roleId: roleByRoleName[s.role],
        phone: "9" + Math.floor(1000000000 + Math.random() * 8999999999).toString(),
      },
    });
  }
  const users = await db.user.findMany({ where: { tenantId: tenant.id } });
  const owner = users.find((u) => u.role === "owner")!;
  const receptionist = users.find((u) => u.role === "receptionist")!;

  // Room types
  for (const rt of ROOM_TYPES) {
    await db.roomType.create({
      data: {
        id: rt.id,
        tenantId: tenant.id,
        name: rt.name,
        basePrice: rt.basePrice,
        capacity: rt.capacity,
        extraBedPrice: rt.extraBedPrice,
        amenities: JSON.stringify(rt.amenities),
      },
    });
  }

  // Rooms — 4 floors x 8 rooms = 32 rooms
  const floors = [
    { floor: 1, type: "rt_standard" },
    { floor: 2, type: "rt_deluxe" },
    { floor: 3, type: "rt_deluxe" },
    { floor: 4, type: "rt_suite" },
  ];
  let roomIdx = 0;
  for (const f of floors) {
    for (let i = 1; i <= 8; i++) {
      const number = `${f.floor}${String(i).padStart(2, "0")}`;
      await db.room.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          number,
          floor: f.floor,
          roomTypeId: f.type,
          status: "available",
        },
      });
      roomIdx++;
    }
  }
  // Extra family rooms on floor 1
  for (let i = 9; i <= 10; i++) {
    await db.room.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        number: `1${String(i).padStart(2, "0")}`,
        floor: 1,
        roomTypeId: "rt_family",
        status: "available",
      },
    });
  }

  const allRooms = await db.room.findMany({ where: { tenantId: tenant.id } });

  // Guests
  for (const g of GUEST_SEED) {
    await db.guest.create({
      data: {
        tenantId: tenant.id,
        name: g.name,
        mobile: g.mobile,
        email: g.email,
        address: `${g.city}, India`,
        idType: "aadhaar",
        idNumber: "XXXX-XXXX-" + Math.floor(1000 + Math.random() * 8999).toString(),
      },
    });
  }
  const allGuests = await db.guest.findMany({ where: { tenantId: tenant.id } });

  // Bookings — a realistic mix across past, today, and future
  let bookingCounter = 1;
  const checkInActual = (status: string, d: Date) =>
    status === "checked_in" || status === "checked_out" ? d : null;
  const checkOutActual = (status: string, d: Date) =>
    status === "checked_out" ? d : null;

  // 6 currently checked-in guests (occupying rooms)
  const currentBookings: { guestIdx: number; roomIdx: number; roomType: string; daysAgo: number; nights: number }[] = [
    { guestIdx: 0, roomIdx: 0, roomType: "rt_standard", daysAgo: 1, nights: 3 },
    { guestIdx: 1, roomIdx: 8, roomType: "rt_deluxe", daysAgo: 2, nights: 4 },
    { guestIdx: 2, roomIdx: 9, roomType: "rt_deluxe", daysAgo: 0, nights: 2 },
    { guestIdx: 3, roomIdx: 16, roomType: "rt_deluxe", daysAgo: 1, nights: 5 },
    { guestIdx: 4, roomIdx: 24, roomType: "rt_suite", daysAgo: 3, nights: 2 },
    { guestIdx: 5, roomIdx: 32, roomType: "rt_family", daysAgo: 0, nights: 2 },
  ];

  for (const cb of currentBookings) {
    const guest = allGuests[cb.guestIdx];
    const room = allRooms[cb.roomIdx];
    const ci = addDays(today, -cb.daysAgo);
    const co = addDays(ci, cb.nights);
    const tariff = ROOM_TYPES.find((r) => r.id === cb.roomType)!.basePrice;
    const total = tariff * cb.nights;
    const advance = Math.round(total * 0.4);
    const code = genCode("BK", bookingCounter++);
    const booking = await db.booking.create({
      data: {
        tenantId: tenant.id,
        bookingCode: code,
        guestId: guest.id,
        roomId: room.id,
        source: "walk_in",
        status: "checked_in",
        checkIn: ci,
        checkOut: co,
        adults: 2,
        children: 0,
        numGuests: 2,
        tariffPerDay: tariff,
        totalAmount: total,
        advancePaid: advance,
        taxRate: 12,
        createdBy: receptionist.id,
        checkInActual: ci,
        specialRequests: cb.guestIdx % 2 === 0 ? "Early check-in requested" : null,
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: advance,
        method: "upi",
        type: "advance",
        reference: "UPI" + Math.floor(Math.random() * 900000 + 100000),
        receivedBy: receptionist.id,
        createdAt: addDays(ci, -1),
      },
    });
    await db.room.update({ where: { id: room.id }, data: { status: "occupied" } });
  }

  // Today's arrivals (confirmed, checking in today)
  const arrivals = [
    { guestIdx: 6, roomIdx: 1, roomType: "rt_standard", nights: 2 },
    { guestIdx: 7, roomIdx: 10, roomType: "rt_deluxe", nights: 3 },
    { guestIdx: 8, roomIdx: 17, roomType: "rt_deluxe", nights: 1 },
  ];
  for (const a of arrivals) {
    const guest = allGuests[a.guestIdx];
    const room = allRooms[a.roomIdx];
    const tariff = ROOM_TYPES.find((r) => r.id === a.roomType)!.basePrice;
    const total = tariff * a.nights;
    const advance = Math.round(total * 0.5);
    const code = genCode("BK", bookingCounter++);
    const booking = await db.booking.create({
      data: {
        tenantId: tenant.id,
        bookingCode: code,
        guestId: guest.id,
        roomId: room.id,
        source: "online",
        status: "confirmed",
        checkIn: today,
        checkOut: addDays(today, a.nights),
        adults: 2,
        children: 0,
        numGuests: 2,
        tariffPerDay: tariff,
        totalAmount: total,
        advancePaid: advance,
        taxRate: 12,
        createdBy: receptionist.id,
        specialRequests: "High floor preferred",
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: advance,
        method: "card",
        type: "advance",
        reference: "CARD" + Math.floor(Math.random() * 900000 + 100000),
        receivedBy: receptionist.id,
        createdAt: addDays(today, -2),
      },
    });
    await db.room.update({ where: { id: room.id }, data: { status: "reserved" } });
  }

  // Today's departures (checked-in, checking out today)
  const departures = [
    { guestIdx: 9, roomIdx: 2, roomType: "rt_standard", nights: 2, daysAgo: 2 },
    { guestIdx: 10, roomIdx: 11, roomType: "rt_deluxe", nights: 3, daysAgo: 3 },
  ];
  for (const d of departures) {
    const guest = allGuests[d.guestIdx];
    const room = allRooms[d.roomIdx];
    const tariff = ROOM_TYPES.find((r) => r.id === d.roomType)!.basePrice;
    const total = tariff * d.nights;
    const advance = Math.round(total * 0.3);
    const ci = addDays(today, -d.daysAgo);
    const co = today;
    const code = genCode("BK", bookingCounter++);
    const booking = await db.booking.create({
      data: {
        tenantId: tenant.id,
        bookingCode: code,
        guestId: guest.id,
        roomId: room.id,
        source: "phone",
        status: "checked_in",
        checkIn: ci,
        checkOut: co,
        adults: 2,
        children: 1,
        numGuests: 3,
        tariffPerDay: tariff,
        totalAmount: total,
        advancePaid: advance,
        taxRate: 12,
        createdBy: receptionist.id,
        checkInActual: ci,
        extraBed: true,
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: advance,
        method: "cash",
        type: "advance",
        receivedBy: receptionist.id,
        createdAt: addDays(ci, -1),
      },
    });
    await db.room.update({ where: { id: room.id }, data: { status: "occupied" } });
  }

  // Past checked-out bookings (history)
  const pastBookings = [
    { guestIdx: 11, roomIdx: 3, roomType: "rt_standard", nights: 2, daysAgo: 5 },
    { guestIdx: 12, roomIdx: 12, roomType: "rt_deluxe", nights: 3, daysAgo: 8 },
    { guestIdx: 13, roomIdx: 25, roomType: "rt_suite", nights: 2, daysAgo: 12 },
    { guestIdx: 14, roomIdx: 4, roomType: "rt_standard", nights: 1, daysAgo: 6 },
    { guestIdx: 0, roomIdx: 13, roomType: "rt_deluxe", nights: 2, daysAgo: 20 },
    { guestIdx: 1, roomIdx: 26, roomType: "rt_suite", nights: 4, daysAgo: 25 },
    { guestIdx: 2, roomIdx: 5, roomType: "rt_standard", nights: 2, daysAgo: 15 },
    { guestIdx: 3, roomIdx: 18, roomType: "rt_deluxe", nights: 3, daysAgo: 18 },
  ];
  for (const p of pastBookings) {
    const guest = allGuests[p.guestIdx];
    const room = allRooms[p.roomIdx];
    const tariff = ROOM_TYPES.find((r) => r.id === p.roomType)!.basePrice;
    const total = tariff * p.nights;
    const ci = addDays(today, -p.daysAgo);
    const co = addDays(ci, p.nights);
    const advance = Math.round(total * 0.5);
    const code = genCode("BK", bookingCounter++);
    const booking = await db.booking.create({
      data: {
        tenantId: tenant.id,
        bookingCode: code,
        guestId: guest.id,
        roomId: room.id,
        source: "walk_in",
        status: "checked_out",
        checkIn: ci,
        checkOut: co,
        adults: 2,
        children: 0,
        numGuests: 2,
        tariffPerDay: tariff,
        totalAmount: total,
        advancePaid: advance,
        taxRate: 12,
        createdBy: receptionist.id,
        checkInActual: ci,
        checkOutActual: co,
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: advance,
        method: "upi",
        type: "advance",
        receivedBy: receptionist.id,
        createdAt: addDays(ci, -1),
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: total - advance,
        method: "cash",
        type: "balance",
        receivedBy: receptionist.id,
        createdAt: co,
      },
    });
  }

  // Future bookings
  const futureBookings = [
    { guestIdx: 11, roomIdx: 6, roomType: "rt_standard", nights: 3, daysAhead: 2 },
    { guestIdx: 12, roomIdx: 19, roomType: "rt_deluxe", nights: 2, daysAhead: 4 },
    { guestIdx: 13, roomIdx: 27, roomType: "rt_suite", nights: 5, daysAhead: 7 },
  ];
  for (const f of futureBookings) {
    const guest = allGuests[f.guestIdx];
    const room = allRooms[f.roomIdx];
    const tariff = ROOM_TYPES.find((r) => r.id === f.roomType)!.basePrice;
    const total = tariff * f.nights;
    const advance = Math.round(total * 0.25);
    const ci = addDays(today, f.daysAhead);
    const code = genCode("BK", bookingCounter++);
    const booking = await db.booking.create({
      data: {
        tenantId: tenant.id,
        bookingCode: code,
        guestId: guest.id,
        roomId: room.id,
        source: "online",
        status: "confirmed",
        checkIn: ci,
        checkOut: addDays(ci, f.nights),
        adults: 2,
        children: 0,
        numGuests: 2,
        tariffPerDay: tariff,
        totalAmount: total,
        advancePaid: advance,
        taxRate: 12,
        createdBy: receptionist.id,
      },
    });
    await db.payment.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        guestId: guest.id,
        amount: advance,
        method: "upi",
        type: "advance",
        receivedBy: receptionist.id,
        createdAt: addDays(today, -1),
      },
    });
    await db.room.update({ where: { id: room.id }, data: { status: "reserved" } });
  }

  // Set a couple of rooms to cleaning / maintenance / blocked
  const cleaningRooms = [allRooms[7], allRooms[15]];
  const maintenanceRooms = [allRooms[23]];
  const blockedRooms = [allRooms[31]];
  for (const r of cleaningRooms) {
    await db.room.update({ where: { id: r.id }, data: { status: "cleaning" } });
    await db.housekeepingTask.create({
      data: {
        tenantId: tenant.id,
        roomId: r.id,
        status: "pending",
        priority: "high",
        notes: "Checkout cleaning — guest left at 10am",
      },
    });
  }
  await db.housekeepingTask.create({
    data: {
      tenantId: tenant.id,
      roomId: allRooms[8].id,
      status: "in_progress",
      priority: "normal",
      assignedTo: users.find((u) => u.role === "housekeeping")?.id,
      notes: "Deep cleaning",
    },
  });
  await db.housekeepingTask.create({
    data: {
      tenantId: tenant.id,
      roomId: allRooms[16].id,
      status: "inspection",
      priority: "normal",
      notes: "Awaiting manager inspection",
    },
  });
  for (const r of maintenanceRooms) {
    await db.room.update({ where: { id: r.id }, data: { status: "maintenance" } });
    await db.housekeepingTask.create({
      data: {
        tenantId: tenant.id,
        roomId: r.id,
        status: "blocked",
        priority: "high",
        notes: "AC repair scheduled",
      },
    });
  }
  for (const r of blockedRooms) {
    await db.room.update({ where: { id: r.id }, data: { status: "blocked" } });
  }

  // Expenses — last 30 days
  const expenseCats = ["salaries", "utilities", "supplies", "maintenance", "food", "marketing", "misc"];
  const expenseAmounts: Record<string, number> = {
    salaries: 68000,
    utilities: 18500,
    supplies: 12400,
    maintenance: 8200,
    food: 32000,
    marketing: 6000,
    misc: 4200,
  };
  for (let day = 0; day < 30; day++) {
    const date = addDays(today, -day);
    // 1-2 expenses per day
    const count = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const cat = expenseCats[Math.floor(Math.random() * expenseCats.length)];
      const base = expenseAmounts[cat] / 30;
      const amt = Math.round(base * (0.5 + Math.random()));
      await db.expense.create({
        data: {
          tenantId: tenant.id,
          category: cat,
          amount: amt,
          description: `${cat.charAt(0).toUpperCase() + cat.slice(1)} expense`,
          method: Math.random() > 0.5 ? "upi" : "cash",
          date,
          userId: owner.id,
        },
      });
    }
  }

  // Extra payments (income) — last 14 days of misc income
  for (let day = 0; day < 14; day++) {
    if (Math.random() > 0.4) {
      const date = addDays(today, -day);
      const amt = 500 + Math.round(Math.random() * 3000);
      const guest = allGuests[Math.floor(Math.random() * allGuests.length)];
      await db.payment.create({
        data: {
          tenantId: tenant.id,
          guestId: guest.id,
          amount: amt,
          method: "cash",
          type: "food",
          notes: "Restaurant bill",
          receivedBy: receptionist.id,
          createdAt: date,
        },
      });
    }
  }

  // Notifications
  const notifs = [
    { type: "check_in", title: "Check-in Today", message: "3 guests scheduled to arrive today" },
    { type: "check_out", title: "Check-out Today", message: "2 guests checking out today" },
    { type: "payment", title: "Pending Payment", message: "Room 209 has a pending balance of ₹1,400" },
    { type: "maintenance", title: "Maintenance Alert", message: "Room 407 AC repair scheduled for today" },
    { type: "booking", title: "New Booking", message: "Booking BK-0015 received via Online channel" },
    { type: "system", title: "Daily Report Ready", message: "Yesterday's revenue report is now available" },
  ];
  for (let i = 0; i < notifs.length; i++) {
    await db.notification.create({
      data: {
        tenantId: tenant.id,
        ...notifs[i],
        read: i > 2,
        createdAt: addDays(today, -i),
      },
    });
  }

  // Subscription plans
  const plans = [
    { name: "Starter", price: 999, interval: "monthly", maxRooms: 10, maxUsers: 3, features: JSON.stringify(["Dashboard", "Bookings", "Rooms", "Guests"]) },
    { name: "Growth", price: 2499, interval: "monthly", maxRooms: 30, maxUsers: 8, features: JSON.stringify(["Everything in Starter", "Housekeeping", "Expenses", "Reports", "Invoicing"]) },
    { name: "Scale", price: 4999, interval: "monthly", maxRooms: 80, maxUsers: 20, features: JSON.stringify(["Everything in Growth", "Multi-property", "Advanced Reports", "Audit Logs"]) },
    { name: "Enterprise", price: 9999, interval: "monthly", maxRooms: 200, maxUsers: 50, features: JSON.stringify(["Everything in Scale", "Custom integrations", "Priority support", "Dedicated manager"]) },
  ];
  for (const p of plans) {
    const plan = await db.subscriptionPlan.create({ data: p });
    if (p.name === "Growth") {
      await db.tenantSubscription.create({
        data: { tenantId: tenant.id, planId: plan.id, status: "active" },
      });
    }
  }

  // Audit logs
  const auditActions = [
    { action: "create", entity: "booking", details: "Created booking BK-0001" },
    { action: "check_in", entity: "booking", details: "Checked in guest Rohan Mehta" },
    { action: "payment", entity: "payment", details: "Received ₹3,000 via UPI" },
    { action: "update", entity: "room", details: "Updated room 104 status to cleaning" },
    { action: "create", entity: "expense", details: "Added electricity expense ₹4,500" },
    { action: "login", entity: "auth", details: "Owner logged in" },
  ];
  for (let i = 0; i < auditActions.length; i++) {
    await db.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: i % 2 === 0 ? owner.id : receptionist.id,
        ...auditActions[i],
        createdAt: addDays(today, -i),
      },
    });
  }

  // ── Second tenant (so Super Admin has multiple to manage) ───────────────
  const tenant2 = await db.tenant.create({
    data: {
      name: "Sunset Beach Resort",
      slug: "sunset-beach",
      contactEmail: "admin@sunsetbeach.in",
      contactPhone: "919876543210",
      address: "Beach Road, Goa",
      plan: "scale",
      status: "active",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });
  // Roles for tenant 2
  const t2OwnerRole = await db.role.create({
    data: {
      tenantId: tenant2.id,
      name: "owner",
      label: "Lodge Owner",
      description: "Full control of the lodge.",
      isSystem: true,
      menuItems: JSON.stringify(DEFAULT_ROLE_PERMISSIONS.owner.menuItems),
    },
  });
  for (const key of DEFAULT_ROLE_PERMISSIONS.owner.permissions) {
    if (permById[key]) {
      await db.rolePermission.create({
        data: { roleId: t2OwnerRole.id, permissionId: permById[key] },
      });
    }
  }
  await db.user.create({
    data: {
      tenantId: tenant2.id,
      name: "Ravi Nair",
      email: "owner@sunsetbeach.in",
      password: "hashed_demo_password",
      role: "owner",
      roleId: t2OwnerRole.id,
      phone: "919876543210",
    },
  });

  // A third tenant — suspended (for variety in Super Admin panel)
  const tenant3 = await db.tenant.create({
    data: {
      name: "Hill View Guest House",
      slug: "hill-view",
      contactEmail: "info@hillview.in",
      contactPhone: "912345678901",
      address: "Ooty, Tamil Nadu",
      plan: "starter",
      status: "suspended",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
  });

  // ── Platform Fee Configurations (Super Admin → Tenants) ───────────────
  await db.platformFeeConfig.create({
    data: {
      tenantId: tenant.id,
      feeType: "percentage",
      feeValue: 5, // 5% of revenue
      active: true,
      notes: "5% of gross monthly revenue",
    },
  });
  await db.platformFeeConfig.create({
    data: {
      tenantId: tenant2.id,
      feeType: "fixed_monthly",
      feeValue: 3000,
      active: true,
      notes: "₹3,000 flat monthly platform fee",
    },
  });
  await db.platformFeeConfig.create({
    data: {
      tenantId: tenant3.id,
      feeType: "per_booking",
      feeValue: 50,
      active: false,
      notes: "Suspended tenant",
    },
  });

  // ── Platform Fee Payments (history) ───────────────────────────────────
  // Pine Valley — last 3 months
  const months = [
    { period: lastMonthKey(2), gross: 95000, rate: 5, due: 4750, paid: 4750, status: "paid", daysAgo: 60, method: "bank_transfer", ref: "NEFT-AXIS-9821" },
    { period: lastMonthKey(1), gross: 102000, rate: 5, due: 5100, paid: 5100, status: "paid", daysAgo: 30, method: "upi", ref: "UPI-PTF-5521" },
    { period: lastMonthKey(0), gross: 110118, rate: 5, due: 5506, paid: 0, status: "pending", daysAgo: -5, method: null, ref: null },
  ];
  for (const m of months) {
    const dueDate = addDays(today, -(today.getDate())); // start of current month
    await db.platformFeePayment.create({
      data: {
        tenantId: tenant.id,
        period: m.period,
        grossRevenue: m.gross,
        feeRate: m.rate,
        amountDue: m.due,
        amountPaid: m.paid,
        status: m.status,
        method: m.method,
        reference: m.ref,
        dueDate: m.daysAgo < 0 ? addDays(today, 5) : addDays(today, -m.daysAgo),
        paidAt: m.status === "paid" ? addDays(today, -m.daysAgo) : null,
      },
    });
  }
  // Sunset Beach — fixed monthly
  for (let i = 2; i >= 0; i--) {
    const dueDate = addDays(addDays(today, -i * 30), 5);
    await db.platformFeePayment.create({
      data: {
        tenantId: tenant2.id,
        period: lastMonthKey(i),
        grossRevenue: 0,
        feeRate: 3000,
        amountDue: 3000,
        amountPaid: i === 0 ? 0 : 3000,
        status: i === 0 ? "pending" : "paid",
        method: i === 0 ? null : "upi",
        reference: i === 0 ? null : `UPI-SBR-${1000 + i}`,
        dueDate,
        paidAt: i === 0 ? null : addDays(dueDate, -2),
      },
    });
  }

  const counts = {
    rooms: await db.room.count({ where: { tenantId: tenant.id } }),
    guests: await db.guest.count({ where: { tenantId: tenant.id } }),
    bookings: await db.booking.count({ where: { tenantId: tenant.id } }),
    payments: await db.payment.count({ where: { tenantId: tenant.id } }),
    expenses: await db.expense.count({ where: { tenantId: tenant.id } }),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
