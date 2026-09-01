import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { json } from "@/lib/server";
import { SESSION_COOKIE } from "@/lib/session";
import { getUserId } from "@/lib/server";

/**
 * POST /api/auth/logout
 * Clears the session cookie and logs the user out.
 */
export async function POST() {
  try {
    const userId = await getUserId();
    // Audit log (best effort — user may already be logged out)
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: "logout",
            entity: "auth",
            details: `${user.name} logged out`,
          },
        });
      }
    }
    const c = await cookies();
    c.delete(SESSION_COOKIE);
    return json({ success: true });
  } catch (e) {
    return json({ success: true }); // always succeed for logout
  }
}
