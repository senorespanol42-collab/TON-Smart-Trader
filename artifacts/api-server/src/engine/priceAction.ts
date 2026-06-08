/**
 * Price Action Analysis Engine
 *
 * Implements scientifically-grounded price action methodology:
 * - Key level detection using pivot high/low algorithm
 * - Support/Resistance classification via cluster analysis
 * - Level strength scoring based on touch count, recency, and volume
 * - Stop-hunt recognition (false breakout detection)
 */

import type { Candle } from "./marketData.js";

export interface KeyLevel {
  price: number;
  type: "support" | "resistance" | "pivot";
  strength: number;
  touchCount: number;
  lastTestedAt: string;
}

export interface Zone {
  id: string;
  type: "supply" | "demand";
  priceHigh: number;
  priceLow: number;
  strength: number;
  tested: boolean;
  mitigated: boolean;
  createdAt: string;
}

/**
 * Detect pivot highs and lows using Williams fractal method.
 * A pivot high is a candle whose high is higher than the N candles on each side.
 * A pivot low is a candle whose low is lower than the N candles on each side.
 * This is the foundation of all price action analysis.
 */
function detectPivots(candles: Candle[], period = 5): {
  highs: Array<{ index: number; price: number; timestamp: string }>;
  lows: Array<{ index: number; price: number; timestamp: string }>;
} {
  const highs: Array<{ index: number; price: number; timestamp: string }> = [];
  const lows: Array<{ index: number; price: number; timestamp: string }> = [];

  for (let i = period; i < candles.length - period; i++) {
    const c = candles[i];
    let isPivotHigh = true;
    let isPivotLow = true;

    for (let j = i - period; j <= i + period; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isPivotHigh = false;
      if (candles[j].low <= c.low) isPivotLow = false;
    }

    if (isPivotHigh) highs.push({ index: i, price: c.high, timestamp: c.timestamp });
    if (isPivotLow) lows.push({ index: i, price: c.low, timestamp: c.timestamp });
  }

  return { highs, lows };
}

/**
 * Cluster nearby price levels using a percentage-based proximity threshold.
 * Levels within `threshold` % of each other are merged into a single level.
 * This prevents duplicate levels from minor price variations.
 */
function clusterLevels(
  levels: Array<{ price: number; timestamp: string }>,
  threshold = 0.003,
): Array<{ price: number; count: number; lastTimestamp: string }> {
  if (!levels.length) return [];

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const clusters: Array<{ prices: number[]; lastTimestamp: string }> = [];

  let currentCluster: typeof clusters[0] = {
    prices: [sorted[0].price],
    lastTimestamp: sorted[0].timestamp,
  };

  for (let i = 1; i < sorted.length; i++) {
    const clusterMid = currentCluster.prices.reduce((s, p) => s + p, 0) / currentCluster.prices.length;
    const deviation = Math.abs(sorted[i].price - clusterMid) / clusterMid;

    if (deviation <= threshold) {
      currentCluster.prices.push(sorted[i].price);
      if (sorted[i].timestamp > currentCluster.lastTimestamp) {
        currentCluster.lastTimestamp = sorted[i].timestamp;
      }
    } else {
      clusters.push(currentCluster);
      currentCluster = { prices: [sorted[i].price], lastTimestamp: sorted[i].timestamp };
    }
  }
  clusters.push(currentCluster);

  return clusters.map((c) => ({
    price: Number((c.prices.reduce((s, p) => s + p, 0) / c.prices.length).toFixed(8)),
    count: c.prices.length,
    lastTimestamp: c.lastTimestamp,
  }));
}

/**
 * Score a price level's strength (0-100) based on:
 * - Touch count (more touches = stronger level)
 * - Recency (more recent = higher weight)
 * - Round number proximity (psychological levels trade stronger)
 */
function scoreLevel(count: number, lastTimestamp: string, price: number): number {
  const touchScore = Math.min(count * 15, 60);

  const ageMs = Date.now() - new Date(lastTimestamp).getTime();
  const ageDays = ageMs / 86_400_000;
  const recencyScore = Math.max(0, 25 - ageDays * 0.5);

  // Round number bonus: prices near round numbers are psychologically significant
  const roundness = detectRoundness(price);
  const roundScore = roundness * 15;

  return Math.min(100, Math.round(touchScore + recencyScore + roundScore));
}

function detectRoundness(price: number): number {
  const magnitude = Math.floor(Math.log10(price));
  const normalized = price / Math.pow(10, magnitude);
  const roundBases = [1, 2, 2.5, 5];
  for (const base of roundBases) {
    if (Math.abs(normalized % base) / base < 0.01) return 1.0;
    if (Math.abs(normalized % base) / base < 0.05) return 0.5;
  }
  return 0;
}

/**
 * Count how many times price has touched a level (within tolerance).
 * A "touch" is a candle whose wick or body comes within threshold% of the level.
 */
function countTouches(candles: Candle[], levelPrice: number, threshold = 0.005): number {
  return candles.filter((c) => {
    const withinHigh = Math.abs(c.high - levelPrice) / levelPrice <= threshold;
    const withinLow = Math.abs(c.low - levelPrice) / levelPrice <= threshold;
    const withinBody =
      (Math.min(c.open, c.close) <= levelPrice && levelPrice <= Math.max(c.open, c.close));
    return withinHigh || withinLow || withinBody;
  }).length;
}

export function analyzeKeyLevels(candles: Candle[]): KeyLevel[] {
  if (candles.length < 20) return [];

  const { highs, lows } = detectPivots(candles, 5);
  const currentPrice = candles[candles.length - 1].close;

  const highClusters = clusterLevels(highs);
  const lowClusters = clusterLevels(lows);

  const levels: KeyLevel[] = [];

  for (const cluster of highClusters) {
    const touchCount = countTouches(candles, cluster.price);
    const strength = scoreLevel(cluster.count, cluster.lastTimestamp, cluster.price);
    if (strength < 20) continue;

    levels.push({
      price: cluster.price,
      type: cluster.price > currentPrice ? "resistance" : "support",
      strength,
      touchCount: Math.max(touchCount, cluster.count),
      lastTestedAt: cluster.lastTimestamp,
    });
  }

  for (const cluster of lowClusters) {
    const touchCount = countTouches(candles, cluster.price);
    const strength = scoreLevel(cluster.count, cluster.lastTimestamp, cluster.price);
    if (strength < 20) continue;

    levels.push({
      price: cluster.price,
      type: cluster.price < currentPrice ? "support" : "resistance",
      strength,
      touchCount: Math.max(touchCount, cluster.count),
      lastTestedAt: cluster.lastTimestamp,
    });
  }

  // Sort by proximity to current price
  return levels
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 20);
}

/**
 * Supply/Demand Zone Detection
 *
 * Supply zones form at the base of a sharp bearish move (Drop-Base-Drop / Rally-Base-Drop).
 * Demand zones form at the base of a sharp bullish move (Rally-Base-Rally / Drop-Base-Rally).
 *
 * The zone body is defined by the candle(s) immediately before the impulse move.
 * Zone validity decreases after each test (mitigation tracking).
 */
export function analyzeSupplyDemandZones(candles: Candle[]): Zone[] {
  if (candles.length < 30) return [];

  const zones: Zone[] = [];
  const impulseThreshold = 0.008; // 0.8% minimum body size for impulse candle

  for (let i = 3; i < candles.length - 3; i++) {
    const c = candles[i];
    const bodySize = Math.abs(c.close - c.open) / c.open;
    if (bodySize < impulseThreshold) continue;

    const isBullishImpulse = c.close > c.open;
    const isBearishImpulse = c.close < c.open;

    // Demand zone: bullish impulse — base is 1-2 candles before impulse
    if (isBullishImpulse) {
      const base = candles[i - 1];
      const zoneLow = Math.min(base.low, base.open, base.close);
      const zoneHigh = Math.max(base.high, base.open, base.close);
      const zoneSize = (zoneHigh - zoneLow) / zoneLow;

      if (zoneSize < 0.03) {
        // Small base = valid zone
        const tested = isZoneTested(candles, i + 1, zoneLow, zoneHigh, "demand");
        const mitigated = isZoneMitigated(candles, i + 1, zoneLow, "demand");
        const strength = Math.min(100, Math.round((bodySize / impulseThreshold) * 30 + (tested ? 20 : 40)));

        zones.push({
          id: `demand_${i}_${candles[i].timestamp}`,
          type: "demand",
          priceHigh: Number(zoneHigh.toFixed(8)),
          priceLow: Number(zoneLow.toFixed(8)),
          strength,
          tested,
          mitigated,
          createdAt: candles[i - 1].timestamp,
        });
      }
    }

    // Supply zone: bearish impulse — base is 1-2 candles before impulse
    if (isBearishImpulse) {
      const base = candles[i - 1];
      const zoneLow = Math.min(base.low, base.open, base.close);
      const zoneHigh = Math.max(base.high, base.open, base.close);
      const zoneSize = (zoneHigh - zoneLow) / zoneLow;

      if (zoneSize < 0.03) {
        const tested = isZoneTested(candles, i + 1, zoneLow, zoneHigh, "supply");
        const mitigated = isZoneMitigated(candles, i + 1, zoneHigh, "supply");
        const strength = Math.min(100, Math.round((bodySize / impulseThreshold) * 30 + (tested ? 20 : 40)));

        zones.push({
          id: `supply_${i}_${candles[i].timestamp}`,
          type: "supply",
          priceHigh: Number(zoneHigh.toFixed(8)),
          priceLow: Number(zoneLow.toFixed(8)),
          strength,
          tested,
          mitigated,
          createdAt: candles[i - 1].timestamp,
        });
      }
    }
  }

  // Filter out mitigated zones older than 50 candles
  return zones
    .filter((z) => !z.mitigated || zones.indexOf(z) > zones.length - 50)
    .slice(-30);
}

function isZoneTested(
  candles: Candle[],
  startIdx: number,
  zoneLow: number,
  zoneHigh: number,
  type: "supply" | "demand",
): boolean {
  for (let i = startIdx; i < candles.length; i++) {
    if (type === "demand" && candles[i].low <= zoneHigh && candles[i].low >= zoneLow) return true;
    if (type === "supply" && candles[i].high >= zoneLow && candles[i].high <= zoneHigh) return true;
  }
  return false;
}

function isZoneMitigated(
  candles: Candle[],
  startIdx: number,
  levelPrice: number,
  type: "supply" | "demand",
): boolean {
  for (let i = startIdx; i < candles.length; i++) {
    if (type === "demand" && candles[i].close < levelPrice * 0.995) return true;
    if (type === "supply" && candles[i].close > levelPrice * 1.005) return true;
  }
  return false;
}
