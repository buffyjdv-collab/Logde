import { db } from "@/lib/db";
import {
  isSuperAdmin,
  json,
  error,
  PLATFORM_TENANT_ID,
} from "@/lib/server";
import { formatPlatformFeeConfig } from "@/lib/formatters";

/**
 * GET /api/super/platform-fees
 * Returns all PlatformFeeConfig rows with their tenant included
 * (excluding the platform tenant).
 */
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return error("Forbidden: super admin only", 403);
    }

    const configs = await db.platformFeeConfig.findMany({
      where: { tenantId: { not: PLATFORM_TENANT_ID } },
      include: { tenant: true },
      orderBy: { createdAt: "desc" },
    });

    return json(
      configs.map((c) => ({
        ...formatPlatformFeeConfig(c),
        tenant: {
          id: c.tenant.id,
          name: c.tenant.name,
          slug: c.tenant.slug,
          plan: c.tenant.plan,
          status: c.tenant.status,
        },
      }))
    );
  } catch (e) {
    console.error("[super.platform-fees.list]", e);
    return error("Failed to load platform fee configs", 500);
  }
}
