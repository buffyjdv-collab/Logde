import { exec } from "child_process";
import { promisify } from "util";
import { json, error } from "@/lib/server";

const execAsync = promisify(exec);

// Re-seed the LodgeHub demo database by running the prisma/seed.ts script.
// The seed script wipes all tenant data and recreates the Pine Valley demo dataset.
export async function POST() {
  try {
    // Run the seed script via bun. The seed script handles its own cleanup
    // (deleteMany on every model) and then re-inserts the demo dataset.
    const { stdout, stderr } = await execAsync("bun prisma/seed.ts", {
      cwd: process.cwd(),
      timeout: 60_000, // 60s safety cap
      maxBuffer: 4 * 1024 * 1024,
    });

    if (process.env.NODE_ENV !== "production") {
      // Surface seed output to the server console for debugging.
      if (stdout) console.log("[seed.stdout]\n" + stdout);
      if (stderr) console.warn("[seed.stderr]\n" + stderr);
    }

    return json({
      success: true,
      message:
        "Database re-seeded successfully. Refresh to see fresh demo data.",
    });
  } catch (e) {
    console.error("[seed.route]", e);
    return error(
      "Re-seed failed — check server logs. You can also run `bun prisma/seed.ts` manually.",
      500
    );
  }
}
