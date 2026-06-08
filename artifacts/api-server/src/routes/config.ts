import { Router } from "express";
import { db, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

async function getOrCreateConfig() {
  const rows = await db.select().from(botConfigTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(botConfigTable).values({}).returning();
  return created;
}

function serialize(row: Awaited<ReturnType<typeof getOrCreateConfig>>) {
  return {
    pair: row.pair,
    interval: row.interval,
    strategy: row.strategy,
    entryFilters: row.entryFilters as object,
    exitRules: row.exitRules as object,
    smcEnabled: row.smcEnabled,
    priceActionEnabled: row.priceActionEnabled,
    volumeFilter: row.volumeFilter,
    sessionFilter: row.sessionFilter,
  };
}

router.get("/config", async (req, res) => {
  try {
    const row = await getOrCreateConfig();
    res.json(serialize(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/config", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const row = await getOrCreateConfig();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.pair !== undefined) update.pair = body.pair;
    if (body.interval !== undefined) update.interval = body.interval;
    if (body.strategy !== undefined) update.strategy = body.strategy;
    if (body.entryFilters !== undefined) update.entryFilters = body.entryFilters;
    if (body.exitRules !== undefined) update.exitRules = body.exitRules;
    if (body.smcEnabled !== undefined) update.smcEnabled = Boolean(body.smcEnabled);
    if (body.priceActionEnabled !== undefined) update.priceActionEnabled = Boolean(body.priceActionEnabled);
    if (body.volumeFilter !== undefined) update.volumeFilter = Boolean(body.volumeFilter);
    if (body.sessionFilter !== undefined) update.sessionFilter = Boolean(body.sessionFilter);

    const [updated] = await db
      .update(botConfigTable)
      .set(update)
      .where(eq(botConfigTable.id, row.id))
      .returning();
    logger.info({ update }, "Bot config updated");
    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
