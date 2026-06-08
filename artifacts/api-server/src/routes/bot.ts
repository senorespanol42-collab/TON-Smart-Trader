import { Router } from "express";
import { db, botStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

async function getOrCreateBotState() {
  const rows = await db.select().from(botStateTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(botStateTable).values({}).returning();
  return created;
}

function serializeStatus(row: Awaited<ReturnType<typeof getOrCreateBotState>>) {
  const uptime = row.state === "running" && row.startedAt
    ? Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 1000)
    : null;
  return {
    state: row.state as "running" | "stopped" | "paused" | "error",
    uptime,
    activePair: row.activePair ?? null,
    totalTrades: row.totalTrades,
    openPositions: 0,
    dailyPnlUsd: Number(row.dailyPnlUsd),
    errorMessage: row.errorMessage ?? null,
    lastSignalAt: row.lastSignalAt ? row.lastSignalAt.toISOString() : null,
  };
}

router.get("/bot/status", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    res.json(serializeStatus(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get bot status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bot/start", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    const [updated] = await db
      .update(botStateTable)
      .set({ state: "running", startedAt: new Date(), errorMessage: null, updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    logger.info("Bot started");
    res.json(serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to start bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bot/stop", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    const [updated] = await db
      .update(botStateTable)
      .set({ state: "stopped", startedAt: null, updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    logger.info("Bot stopped");
    res.json(serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to stop bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bot/pause", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    const [updated] = await db
      .update(botStateTable)
      .set({ state: "paused", updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    logger.info("Bot paused");
    res.json(serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to pause bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
