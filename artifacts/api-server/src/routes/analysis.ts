import { Router } from "express";
import { generateOhlcv, STORM_PAIRS } from "../engine/marketData.js";
import { analyzeKeyLevels, analyzeSupplyDemandZones } from "../engine/priceAction.js";
import { analyzeMarketStructure } from "../engine/smc.js";
import { generateSignal } from "../engine/signals.js";
import { db, botConfigTable } from "@workspace/db";
import type { Request, Response } from "express";

const router = Router();

function pairNotFound(pair: string | undefined, res: Response): boolean {
  if (!pair) {
    res.status(400).json({ error: "pair is required" });
    return true;
  }
  const valid = STORM_PAIRS.find((p) => p.symbol === pair);
  if (!valid) {
    res.status(404).json({ error: "Unknown pair" });
    return true;
  }
  return false;
}

router.get("/analysis/levels", async (req: Request, res: Response) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (pairNotFound(pair, res)) return;

  try {
    const candles = await generateOhlcv(pair, interval, 300);
    const levels = analyzeKeyLevels(candles);
    res.json({ pair, interval, levels, generatedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analysis/zones", async (req: Request, res: Response) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (pairNotFound(pair, res)) return;

  try {
    const candles = await generateOhlcv(pair, interval, 300);
    const zones = analyzeSupplyDemandZones(candles);
    res.json({ pair, interval, zones, generatedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analysis/structure", async (req: Request, res: Response) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  if (pairNotFound(pair, res)) return;

  try {
    const candles = await generateOhlcv(pair, interval, 300);
    const structure = analyzeMarketStructure(candles);
    res.json({
      pair,
      interval,
      trend: structure.trend,
      internalTrend: structure.internalTrend,
      points: structure.points.slice(-50),
      generatedAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analysis/signal", async (req: Request, res: Response) => {
  const pair = req.query.pair as string;
  if (pairNotFound(pair, res)) return;

  try {
    const configRows = await db.select().from(botConfigTable).limit(1);
    const config = configRows[0];
    const filters = config?.entryFilters as Record<string, unknown> | null;

    const interval = config?.interval || "1h";
    const candles = await generateOhlcv(pair, interval, 300);

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
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
