import { Router } from "express";
import { db, riskLimitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

async function getOrCreateRiskLimits() {
  const rows = await db.select().from(riskLimitsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(riskLimitsTable).values({}).returning();
  return created;
}

function serialize(row: Awaited<ReturnType<typeof getOrCreateRiskLimits>>) {
  return {
    maxDailyLossUsd: Number(row.maxDailyLossUsd),
    maxPositionSizeUsd: Number(row.maxPositionSizeUsd),
    maxOpenPositions: row.maxOpenPositions,
    maxLeverage: Number(row.maxLeverage),
    stopLossPercent: Number(row.stopLossPercent),
    takeProfitPercent: Number(row.takeProfitPercent),
    maxDrawdownPercent: Number(row.maxDrawdownPercent),
    enabled: row.enabled,
  };
}

router.get("/risk-limits", async (req, res) => {
  try {
    const row = await getOrCreateRiskLimits();
    res.json(serialize(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get risk limits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/risk-limits", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const row = await getOrCreateRiskLimits();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.maxDailyLossUsd !== undefined) update.maxDailyLossUsd = String(body.maxDailyLossUsd);
    if (body.maxPositionSizeUsd !== undefined) update.maxPositionSizeUsd = String(body.maxPositionSizeUsd);
    if (body.maxOpenPositions !== undefined) update.maxOpenPositions = Number(body.maxOpenPositions);
    if (body.maxLeverage !== undefined) update.maxLeverage = String(body.maxLeverage);
    if (body.stopLossPercent !== undefined) update.stopLossPercent = String(body.stopLossPercent);
    if (body.takeProfitPercent !== undefined) update.takeProfitPercent = String(body.takeProfitPercent);
    if (body.maxDrawdownPercent !== undefined) update.maxDrawdownPercent = String(body.maxDrawdownPercent);
    if (body.enabled !== undefined) update.enabled = Boolean(body.enabled);

    const [updated] = await db
      .update(riskLimitsTable)
      .set(update)
      .where(eq(riskLimitsTable.id, row.id))
      .returning();
    logger.info({ update }, "Risk limits updated");
    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update risk limits");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
