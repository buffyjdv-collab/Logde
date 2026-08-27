import { formatBooking } from "@/lib/formatters";

/**
 * Standard include set used by all booking endpoints to populate the
 * relations expected by `formatBooking`.
 *
 * NOTE: the Prisma schema names the relation `user` (the FK column is
 * `createdBy`). `formatBooking` expects the User object on a field
 * called `createdBy`, so use `withCreatedBy` to map it before formatting.
 */
export const BOOKING_INCLUDE = {
  guest: true,
  room: { include: { roomType: true, property: true } },
  user: true,
  payments: true,
} as const;

/**
 * Maps a Prisma Booking result (which exposes the relation as `user`)
 * into the shape expected by `formatBooking` (which expects `createdBy`
 * to be a User object).
 */
export function withCreatedBy<
  T extends { user?: unknown; createdBy?: unknown }
>(b: T) {
  return { ...b, createdBy: b.user } as T;
}

export { formatBooking };
