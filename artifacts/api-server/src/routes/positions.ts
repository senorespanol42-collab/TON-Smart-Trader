import { Router } from "express";
import { db, positionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

function serializePosition(row: typeof positionsTable.$inferSelect) {
  return {
    id: row.id,
    pair: row.pair,
    side: row.side as "long" | "short",
    entryPrice: Number(row.entryPrice),
    currentPrice: Number(row.currentPrice),
    size: Number(row.size),
    sizeUsd: Number(row.sizeUsd),
    leverage: Number(row.leverage),
    unrealizedPnlUsd: Number(row.unrealizedPnlUsd),
    unrealizedPnlPercent: Number(row.unrealizedPnlPercent),
    stopLoss: Number(row.stopLoss),
    takeProfit: Number(row.takeProfit),
    openedAt: row.openedAt.toISOString(),
    entryReason: row.entryReason,
  };
}

router.get("/positions", async (req, res) => {
  try {
    const rows = await db.select().from(positionsTable);
    res.json(rows.map(serializePosition));
  } catch (err) {
    req.log.error({ err }, "Failed to get positions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/positions/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(positionsTable)
      .where(eq(positionsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Position not found" });
      return;
    }
    res.json(serializePosition(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get position");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/positions/:id/close", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(positionsTable)
      .where(eq(positionsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Position not found" });
      return;
    }
    await db.delete(positionsTable).where(eq(positionsTable.id, req.params.id));
    logger.info({ positionId: req.params.id }, "Position manually closed");
    res.json({ success: true, message: "Position closed successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to close position");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
