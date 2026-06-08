import { Router } from "express";
import { db, botStateTable, positionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { startBotLoop, stopBotLoop } from "../services/botLoop.js";

const router = Router();

async function getOrCreateBotState() {
  const rows = await db.select().from(botStateTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(botStateTable).values({}).returning();
  return created;
}

async function serializeStatus(row: Awaited<ReturnType<typeof getOrCreateBotState>>) {
  const [{ openCount }] = await db.select({ openCount: count() }).from(positionsTable);
  const uptime =
    row.state === "running" && row.startedAt
      ? Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 1000)
      : null;
  return {
    state: row.state as "running" | "stopped" | "paused" | "error",
    uptime,
    activePair: row.activePair ?? null,
    totalTrades: row.totalTrades,
    openPositions: openCount,
    dailyPnlUsd: Number(row.dailyPnlUsd),
    errorMessage: row.errorMessage ?? null,
    lastSignalAt: row.lastSignalAt ? row.lastSignalAt.toISOString() : null,
    theoreticalMode: row.theoreticalMode,
    theoreticalBalance: row.theoreticalBalance != null ? Number(row.theoreticalBalance) : null,
  };
}

router.get("/bot/status", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    res.json(await serializeStatus(row));
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
      .set({ state: "running", startedAt: new Date(), errorMessage: null, theoreticalMode: false, updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    startBotLoop();
    logger.info("Bot started — real trading loop active");
    res.json(await serializeStatus(updated));
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
      .set({ state: "stopped", startedAt: null, theoreticalMode: false, updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    stopBotLoop();
    logger.info("Bot stopped");
    res.json(await serializeStatus(updated));
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
    stopBotLoop();
    logger.info("Bot paused");
    res.json(await serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to pause bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Theoretical Mode ──────────────────────────────────────────────────────────

router.post("/bot/theoretical/start", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    const [updated] = await db
      .update(botStateTable)
      .set({
        state: "running",
        startedAt: new Date(),
        errorMessage: null,
        theoreticalMode: true,
        theoreticalBalance: "1000.0000",
        dailyPnlUsd: "0",
        totalTrades: 0,
        updatedAt: new Date(),
      })
      .where(eq(botStateTable.id, row.id))
      .returning();
    startBotLoop();
    logger.info("Bot started — theoretical (paper trading) mode, $1000 virtual balance");
    res.json(await serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to start theoretical bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bot/theoretical/stop", async (req, res) => {
  try {
    const row = await getOrCreateBotState();
    const [updated] = await db
      .update(botStateTable)
      .set({ state: "stopped", startedAt: null, theoreticalMode: false, updatedAt: new Date() })
      .where(eq(botStateTable.id, row.id))
      .returning();
    stopBotLoop();
    logger.info("Theoretical bot stopped");
    res.json(await serializeStatus(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to stop theoretical bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
