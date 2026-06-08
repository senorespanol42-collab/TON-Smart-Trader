import { Router } from "express";
import { STORM_PAIRS, getCurrentPrice, generateOhlcv } from "../engine/marketData.js";

const router = Router();

router.get("/market/pairs", (_req, res) => {
  res.json(STORM_PAIRS);
});

router.get("/market/price", async (req, res) => {
  const pair = req.query.pair as string;
  if (!pair) {
    res.status(400).json({ error: "pair is required" });
    return;
  }
  const valid = STORM_PAIRS.find((p) => p.symbol === pair);
  if (!valid) {
    res.status(404).json({ error: "Unknown pair" });
    return;
  }
  try {
    const data = await getCurrentPrice(pair);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch price");
    res.status(502).json({ error: "Failed to fetch real-time price from exchange" });
  }
});

router.get("/market/ohlcv", async (req, res) => {
  const pair = req.query.pair as string;
  const interval = (req.query.interval as string) || "1h";
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  if (!pair) {
    res.status(400).json({ error: "pair is required" });
    return;
  }
  const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
  if (!validIntervals.includes(interval)) {
    res.status(400).json({ error: "Invalid interval" });
    return;
  }
  try {
    const candles = await generateOhlcv(pair, interval, limit);
    res.json(candles);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch OHLCV");
    res.status(502).json({ error: "Failed to fetch candle data from exchange" });
  }
});

export default router;
