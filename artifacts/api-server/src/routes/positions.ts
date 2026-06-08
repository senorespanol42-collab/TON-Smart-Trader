import { Router } from "express";
import { db, positionsTable, tradesTable, botStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { closePosition } from "../services/stormExecutor.js";
import crypto from "crypto";

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
    txHash: row.txHash ?? null,
    isTheoretical: row.isTheoretical,
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

    const entry = Number(row.entryPrice);
    const current = Number(row.currentPrice);
    const leverage = Number(row.leverage);
    const sizeUsd = Number(row.sizeUsd);
    const side = row.side as "long" | "short";

    // Storm Trade exact P&L math (matches smart contract)
    const positionSizeBase = sizeUsd / entry;
    const rawPnl =
      side === "long"
        ? (current - entry) * positionSizeBase
        : (entry - current) * positionSizeBase;
    const openFee  = sizeUsd * 0.0006; // 0.06% of notional
    const closeFee = sizeUsd * 0.0006;
    const netPnl   = rawPnl - openFee - closeFee;
    const margin   = sizeUsd / leverage;
    const pnlPct   = (netPnl / margin) * 100;

    const isTheoretical = row.isTheoretical;

    // Real mode: close on-chain
    let closeError: string | null = null;
    if (!isTheoretical) {
      try {
        await closePosition({ pair: row.pair, direction: side, size: Number(row.size) });
      } catch (err) {
        closeError = String(err);
        logger.error({ err }, "On-chain close failed — recording exit in DB anyway");
      }
    }

    // Record closed trade
    await db.insert(tradesTable).values({
      id: crypto.randomUUID(),
      pair: row.pair,
      side,
      entryPrice: row.entryPrice,
      exitPrice: row.currentPrice,
      size: row.size,
      sizeUsd: row.sizeUsd,
      leverage: row.leverage,
      realizedPnlUsd: netPnl.toFixed(4),
      realizedPnlPercent: pnlPct.toFixed(4),
      openFeeUsd: openFee.toFixed(4),
      closeFeeUsd: closeFee.toFixed(4),
      openedAt: row.openedAt,
      closedAt: new Date(),
      exitReason: "manual",
      confluenceScore: "0",
      isTheoretical,
    });

    // Theoretical mode: return margin + rawPnl - closeFee to virtual balance
    if (isTheoretical) {
      const [stateRow] = await db.select().from(botStateTable).limit(1);
      if (stateRow && stateRow.theoreticalBalance != null) {
        const newBalance = Number(stateRow.theoreticalBalance) + margin + rawPnl - closeFee;
        const newDailyPnl = Number(stateRow.dailyPnlUsd) + netPnl;
        await db
          .update(botStateTable)
          .set({ theoreticalBalance: newBalance.toFixed(4), dailyPnlUsd: newDailyPnl.toFixed(4), updatedAt: new Date() })
          .where(eq(botStateTable.id, stateRow.id));
      }
    }

    await db.delete(positionsTable).where(eq(positionsTable.id, req.params.id));

    logger.info({ positionId: req.params.id, netPnl }, "Position manually closed");
    res.json({
      success: true,
      message: closeError ? `Position closed (on-chain tx failed: ${closeError})` : isTheoretical ? "Simulation position closed" : "Position closed on Storm Trade",
      pnlUsd: netPnl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to close position");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
