import { Router } from "express";
import { STORM_PAIRS, getCurrentPrice, generateOhlcv } from "../engine/marketData.js";

const router = Router();

router.get("/market/pairs", (_req, res) => {
  res.json(STORM_PAIRS);
});

router.get("/market/price", (req, res) => {
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
  res.json(getCurrentPrice(pair));
});

router.get("/market/ohlcv", (req, res) => {
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
  const candles = generateOhlcv(pair, interval, limit);
  res.json(candles);
});

export default router;
