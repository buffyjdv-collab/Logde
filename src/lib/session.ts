import { createHmac } from "crypto";

// LodgeHub — session helpers
// We use a signed-cookie session: the cookie value is `userId.signature`
// where signature = HMAC-SHA256(userId, secret). This is stateless and
// tamper-proof without needing a session store or JWT library.

const SECRET =
  process.env.SESSION_SECRET || "lodgehub-demo-session-secret-change-me";

const COOKIE_NAME = "lodgehub-session";

/**
 * Create a signed session value for a user id.
 */
export function createSession(userId: string): string {
  const sig = sign(userId);
  return `${userId}.${sig}`;
}

/**
 * Verify a session value and return the user id if valid.
 */
export function verifySession(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const idx = value.lastIndexOf(".");
  if (idx === -1) return null;
  const userId = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  if (!userId || !sig) return null;
  if (sign(userId) !== sig) return null;
  return userId;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export const SESSION_COOKIE = COOKIE_NAME;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
