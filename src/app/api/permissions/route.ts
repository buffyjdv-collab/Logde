import { json, error } from "@/lib/server";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { formatPermission } from "@/lib/formatters";
import { db } from "@/lib/db";

/**
 * GET /api/permissions
 * Returns the full permission catalog (read-only, no auth required).
 * Sources from the in-code PERMISSION_CATALOG and joins the persisted Permission
 * rows so callers receive the database id alongside the catalog metadata.
 * Result is ordered by module, then action.
 */
export async function GET() {
  try {
    // Pull persisted Permission rows to obtain their ids.
    const persisted = await db.permission.findMany();
    const idByKey = new Map(persisted.map((p) => [p.key, p.id]));

    const permissions = [...PERMISSION_CATALOG]
      .sort((a, b) => {
        if (a.module === b.module) return a.action.localeCompare(b.action);
        return a.module.localeCompare(b.module);
      })
      .map((p) =>
        formatPermission({
          id: idByKey.get(p.key) ?? p.key,
          key: p.key,
          module: p.module,
          action: p.action,
          label: p.label,
          description: p.description ?? null,
          isSuperAdmin: p.isSuperAdmin ?? false,
        })
      );

    return json(permissions);
  } catch (e) {
    console.error("[permissions.list]", e);
    return error("Failed to load permission catalog", 500);
  }
}
