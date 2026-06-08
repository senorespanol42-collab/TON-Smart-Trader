import { Router } from "express";
import { generateOhlcv, STORM_PAIRS } from "../engine/marketData.js";
import { analyzeKeyLevels, analyzeSupplyDemandZones } from "../engine/priceAction.js";
import { analyzeMarketStructure } from "../engine/smc.js";
import { generateSignal } from "../engine/signals.js";
import { db, botConfigTable } from "@workspace/db";

const router = Router();

function validatePair(pair: string | undefined, res: Parameters<Parameters<typeof Router>[0]>[1]): boolean {
  if (!pair) {
    res.status(400).json({ error: "pair is required" });
    return false;
  }
  const valid = STORM_PAIRS.find((p) => p.symbol === pair);
  if (!valid) {
    res.status(404).json({ error: "Unknown pair" });
    return false;
  }
  return true;
}

router.get("/analysis/levels", (req, res) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (!validatePair(pair, res)) return;

  const candles = generateOhlcv(pair, interval, 300);
  const levels = analyzeKeyLevels(candles);

  res.json({
    pair,
    interval,
    levels,
    generatedAt: new Date().toISOString(),
  });
});

router.get("/analysis/zones", (req, res) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (!validatePair(pair, res)) return;

  const candles = generateOhlcv(pair, interval, 300);
  const zones = analyzeSupplyDemandZones(candles);

  res.json({
    pair,
    interval,
    zones,
    generatedAt: new Date().toISOString(),
  });
});

router.get("/analysis/structure", (req, res) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (!validatePair(pair, res)) return;

  const candles = generateOhlcv(pair, interval, 300);
  const structure = analyzeMarketStructure(candles);

  res.json({
    pair,
    interval,
    trend: structure.trend,
    internalTrend: structure.internalTrend,
    points: structure.points.slice(-50),
    generatedAt: new Date().toISOString(),
  });
});

router.get("/analysis/signal", async (req, res) => {
  const pair = req.query.pair as string;
  if (!validatePair(pair, res)) return;

  try {
    const configRows = await db.select().from(botConfigTable).limit(1);
    const config = configRows[0];
    const filters = config?.entryFilters as Record<string, unknown> | null;

    const interval = config?.interval || "1h";
    const candles = generateOhlcv(pair, interval, 300);

    const entryFilters = filters
      ? {
          minConfluenceScore: Number(filters.minConfluenceScore ?? 65),
          requireBos: Boolean(filters.requireBos ?? true),
          requireChoch: Boolean(filters.requireChoch ?? false),
          requireFvg: Boolean(filters.requireFvg ?? true),
          requireOrderBlock: Boolean(filters.requireOrderBlock ?? true),
          minRiskReward: Number(filters.minRiskReward ?? 2.0),
        }
      : undefined;

    const signal = generateSignal(pair, candles, entryFilters);
    res.json(signal);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
