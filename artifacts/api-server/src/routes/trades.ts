import { Router } from "express";
import { db, tradesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

function serializeTrade(row: typeof tradesTable.$inferSelect) {
  return {
    id: row.id,
    pair: row.pair,
    side: row.side as "long" | "short",
    entryPrice: Number(row.entryPrice),
    exitPrice: Number(row.exitPrice),
    size: Number(row.size),
    sizeUsd: Number(row.sizeUsd),
    leverage: Number(row.leverage),
    realizedPnlUsd: Number(row.realizedPnlUsd),
    realizedPnlPercent: Number(row.realizedPnlPercent),
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt.toISOString(),
    exitReason: row.exitReason as "take_profit" | "stop_loss" | "trailing_stop" | "manual" | "risk_limit",
    confluenceScore: Number(row.confluenceScore),
  };
}

router.get("/trades", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const pair = req.query.pair as string | undefined;

    const rows = pair
      ? await db.select().from(tradesTable).where(eq(tradesTable.pair, pair)).orderBy(desc(tradesTable.closedAt)).limit(limit)
      : await db.select().from(tradesTable).orderBy(desc(tradesTable.closedAt)).limit(limit);

    res.json(rows.map(serializeTrade));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
