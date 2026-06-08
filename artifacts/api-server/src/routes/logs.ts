import { Router } from "express";
import { db, logsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const level = req.query.level as string | undefined;

    let rows;
    if (level && level !== "null") {
      rows = await db
        .select()
        .from(logsTable)
        .where(eq(logsTable.level, level))
        .orderBy(desc(logsTable.timestamp))
        .limit(limit);
    } else {
      rows = await db.select().from(logsTable).orderBy(desc(logsTable.timestamp)).limit(limit);
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        level: r.level,
        message: r.message,
        category: r.category,
        metadata: r.metadata ?? null,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
