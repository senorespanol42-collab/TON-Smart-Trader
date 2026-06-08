/**
 * Smart Money Concepts (SMC) Engine
 *
 * Implements institutional-grade market analysis concepts:
 *
 * 1. Market Structure Analysis
 *    - Higher Highs (HH) / Higher Lows (HL) — bullish structure
 *    - Lower Highs (LH) / Lower Lows (LL) — bearish structure
 *    - Break of Structure (BOS) — continuation signal
 *    - Change of Character (CHoCH) — reversal signal
 *    - Equal Highs / Equal Lows — liquidity pools
 *
 * 2. Order Block Detection
 *    - Bullish Order Block: last bearish candle before a bullish impulse
 *    - Bearish Order Block: last bullish candle before a bearish impulse
 *    - Validity assessment: fresh vs. tested vs. mitigated
 *
 * 3. Fair Value Gap (FVG) / Imbalance
 *    - Bullish FVG: gap between candle[i-1].high and candle[i+1].low
 *    - Bearish FVG: gap between candle[i+1].high and candle[i-1].low
 *    - Price tends to return to fill FVGs before continuing
 *
 * 4. Liquidity Pools
 *    - Previous swing highs/lows act as liquidity targets
 *    - Equal highs/lows signal stop-hunt potential
 *    - Institutional orders accumulate above/below these levels
 *
 * References:
 * - ICT (Inner Circle Trader) methodology
 * - Smart Money Concepts by Mentfx
 * - Institutional order flow theory
 */

import type { Candle } from "./marketData.js";

export type StructurePointType =
  | "HH" | "HL" | "LH" | "LL"
  | "BOS" | "CHOCH"
  | "EQUAL_HIGH" | "EQUAL_LOW";

export interface StructurePoint {
  type: StructurePointType;
  price: number;
  timestamp: string;
}

export interface OrderBlock {
  id: string;
  type: "bullish" | "bearish";
  priceHigh: number;
  priceLow: number;
  strength: number;
  tested: boolean;
  mitigated: boolean;
  createdAt: string;
}

export interface FairValueGap {
  id: string;
  type: "bullish" | "bearish";
  priceHigh: number;
  priceLow: number;
  filled: boolean;
  createdAt: string;
}

export interface MarketStructureAnalysis {
  trend: "bullish" | "bearish" | "ranging";
  internalTrend: "bullish" | "bearish" | "ranging";
  points: StructurePoint[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  hasBOS: boolean;
  hasCHoCH: boolean;
  lastBOSPrice: number | null;
  lastCHoCHPrice: number | null;
}

/**
 * Identify swing highs and lows using a lookback period.
 * These form the foundation of market structure identification.
 */
function findSwings(candles: Candle[], lookback = 3): {
  swingHighs: Array<{ idx: number; price: number; ts: string }>;
  swingLows: Array<{ idx: number; price: number; ts: string }>;
} {
  const swingHighs: Array<{ idx: number; price: number; ts: string }> = [];
  const swingLows: Array<{ idx: number; price: number; ts: string }> = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
    }

    if (isHigh) swingHighs.push({ idx: i, price: c.high, ts: c.timestamp });
    if (isLow) swingLows.push({ idx: i, price: c.low, ts: c.timestamp });
  }

  return { swingHighs, swingLows };
}

const EQUAL_THRESHOLD = 0.002; // 0.2% — equal high/low tolerance

/**
 * Build labeled market structure from swing points.
 * Labels each swing relative to the previous swing of the same type:
 *   HH: swing high > last swing high
 *   HL: swing low > last swing low (in uptrend context)
 *   LH: swing high < last swing high
 *   LL: swing low < last swing low
 */
function labelStructure(
  swingHighs: Array<{ idx: number; price: number; ts: string }>,
  swingLows: Array<{ idx: number; price: number; ts: string }>,
): StructurePoint[] {
  const points: StructurePoint[] = [];

  // Label swing highs
  for (let i = 1; i < swingHighs.length; i++) {
    const prev = swingHighs[i - 1];
    const curr = swingHighs[i];
    const ratio = (curr.price - prev.price) / prev.price;

    if (Math.abs(ratio) <= EQUAL_THRESHOLD) {
      points.push({ type: "EQUAL_HIGH", price: curr.price, timestamp: curr.ts });
    } else if (curr.price > prev.price) {
      points.push({ type: "HH", price: curr.price, timestamp: curr.ts });
    } else {
      points.push({ type: "LH", price: curr.price, timestamp: curr.ts });
    }
  }

  // Label swing lows
  for (let i = 1; i < swingLows.length; i++) {
    const prev = swingLows[i - 1];
    const curr = swingLows[i];
    const ratio = (curr.price - prev.price) / prev.price;

    if (Math.abs(ratio) <= EQUAL_THRESHOLD) {
      points.push({ type: "EQUAL_LOW", price: curr.price, timestamp: curr.ts });
    } else if (curr.price > prev.price) {
      points.push({ type: "HL", price: curr.price, timestamp: curr.ts });
    } else {
      points.push({ type: "LL", price: curr.price, timestamp: curr.ts });
    }
  }

  // Sort chronologically
  return points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Detect Break of Structure (BOS) and Change of Character (CHoCH).
 *
 * BOS: Price breaks a swing high/low in the direction of the prevailing trend.
 *      Signals trend continuation.
 *
 * CHoCH: Price breaks a swing high/low AGAINST the prevailing trend.
 *        Signals a potential trend reversal. This is the key entry signal.
 *
 * This distinction is critical for avoiding false breakout entries.
 */
function detectBOSCHoCH(
  candles: Candle[],
  points: StructurePoint[],
  trend: "bullish" | "bearish" | "ranging",
): { points: StructurePoint[]; hasBOS: boolean; hasCHoCH: boolean; lastBOSPrice: number | null; lastCHoCHPrice: number | null } {
  let hasBOS = false;
  let hasCHoCH = false;
  let lastBOSPrice: number | null = null;
  let lastCHoCHPrice: number | null = null;
  const enhancedPoints = [...points];

  const lastHH = [...points].filter((p) => p.type === "HH").pop();
  const lastLL = [...points].filter((p) => p.type === "LL").pop();

  const current = candles[candles.length - 1].close;

  if (trend === "bullish" && lastLL) {
    if (current < lastLL.price) {
      // Price broke below last LL in a bullish structure = CHoCH
      hasCHoCH = true;
      lastCHoCHPrice = lastLL.price;
      enhancedPoints.push({ type: "CHOCH", price: lastLL.price, timestamp: candles[candles.length - 1].timestamp });
    } else if (lastHH && current > lastHH.price) {
      // Price broke above last HH in a bullish structure = BOS (continuation)
      hasBOS = true;
      lastBOSPrice = lastHH.price;
      enhancedPoints.push({ type: "BOS", price: lastHH.price, timestamp: candles[candles.length - 1].timestamp });
    }
  } else if (trend === "bearish" && lastHH) {
    if (current > lastHH.price) {
      // Price broke above last HH in a bearish structure = CHoCH
      hasCHoCH = true;
      lastCHoCHPrice = lastHH.price;
      enhancedPoints.push({ type: "CHOCH", price: lastHH.price, timestamp: candles[candles.length - 1].timestamp });
    } else if (lastLL && current < lastLL.price) {
      // Price broke below last LL in a bearish structure = BOS (continuation)
      hasBOS = true;
      lastBOSPrice = lastLL.price;
      enhancedPoints.push({ type: "BOS", price: lastLL.price, timestamp: candles[candles.length - 1].timestamp });
    }
  }

  return { points: enhancedPoints, hasBOS, hasCHoCH, lastBOSPrice, lastCHoCHPrice };
}

/**
 * Classify the overall trend from labeled structure points.
 * Requires a sequence of HH+HL for bullish, LL+LH for bearish.
 * Returns "ranging" if no clear directional bias in last N structure points.
 */
function classifyTrend(points: StructurePoint[]): "bullish" | "bearish" | "ranging" {
  const recent = points.slice(-8);
  const hhCount = recent.filter((p) => p.type === "HH").length;
  const hlCount = recent.filter((p) => p.type === "HL").length;
  const llCount = recent.filter((p) => p.type === "LL").length;
  const lhCount = recent.filter((p) => p.type === "LH").length;

  const bullScore = hhCount + hlCount;
  const bearScore = llCount + lhCount;

  if (bullScore > bearScore + 1) return "bullish";
  if (bearScore > bullScore + 1) return "bearish";
  return "ranging";
}

/**
 * Detect Order Blocks.
 * A bullish OB is the last bearish candle before a 3-candle bullish impulse.
 * A bearish OB is the last bullish candle before a 3-candle bearish impulse.
 * Order blocks represent institutional order flow zones.
 */
function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const impulseMinBodySize = 0.006;

  for (let i = 3; i < candles.length - 1; i++) {
    // Check for 3-candle bullish impulse
    const bullImpulse = candles.slice(i - 2, i + 1).every((c) => c.close > c.open);
    if (bullImpulse) {
      // Look for last bearish candle before this impulse
      for (let j = i - 3; j >= Math.max(0, i - 8); j--) {
        if (candles[j].close < candles[j].open) {
          const bodySize = Math.abs(candles[j].close - candles[j].open) / candles[j].open;
          if (bodySize < impulseMinBodySize) break;

          const currentPrice = candles[candles.length - 1].close;
          const mitigated = currentPrice < candles[j].low;

          blocks.push({
            id: `bullish_ob_${j}`,
            type: "bullish",
            priceHigh: Math.max(candles[j].open, candles[j].close),
            priceLow: Math.min(candles[j].open, candles[j].close),
            strength: Math.min(100, Math.round(70 + bodySize * 1000)),
            tested: currentPrice <= Math.max(candles[j].open, candles[j].close) * 1.001,
            mitigated,
            createdAt: candles[j].timestamp,
          });
          break;
        }
      }
    }

    // Check for 3-candle bearish impulse
    const bearImpulse = candles.slice(i - 2, i + 1).every((c) => c.close < c.open);
    if (bearImpulse) {
      for (let j = i - 3; j >= Math.max(0, i - 8); j--) {
        if (candles[j].close > candles[j].open) {
          const bodySize = Math.abs(candles[j].close - candles[j].open) / candles[j].open;
          if (bodySize < impulseMinBodySize) break;

          const currentPrice = candles[candles.length - 1].close;
          const mitigated = currentPrice > candles[j].high;

          blocks.push({
            id: `bearish_ob_${j}`,
            type: "bearish",
            priceHigh: Math.max(candles[j].open, candles[j].close),
            priceLow: Math.min(candles[j].open, candles[j].close),
            strength: Math.min(100, Math.round(70 + bodySize * 1000)),
            tested: currentPrice >= Math.min(candles[j].open, candles[j].close) * 0.999,
            mitigated,
            createdAt: candles[j].timestamp,
          });
          break;
        }
      }
    }
  }

  return blocks.filter((b) => !b.mitigated).slice(-10);
}

/**
 * Detect Fair Value Gaps (FVG / Imbalance).
 * A bullish FVG occurs when candle[i-1].high < candle[i+1].low — a gap filled
 * by an aggressive impulse that left a price inefficiency.
 * Price typically returns to fill (or partially fill) FVGs.
 */
function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const minGapPercent = 0.002;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: prev.high < next.low
    const bullGapHigh = next.low;
    const bullGapLow = prev.high;
    if (bullGapHigh > bullGapLow) {
      const gapSize = (bullGapHigh - bullGapLow) / bullGapLow;
      if (gapSize >= minGapPercent && curr.close > curr.open) {
        const filled = candles.slice(i + 1).some((c) => c.low <= bullGapLow * 1.001);
        fvgs.push({
          id: `bullish_fvg_${i}`,
          type: "bullish",
          priceHigh: Number(bullGapHigh.toFixed(8)),
          priceLow: Number(bullGapLow.toFixed(8)),
          filled,
          createdAt: curr.timestamp,
        });
      }
    }

    // Bearish FVG: prev.low > next.high
    const bearGapLow = next.high;
    const bearGapHigh = prev.low;
    if (bearGapHigh > bearGapLow) {
      const gapSize = (bearGapHigh - bearGapLow) / bearGapLow;
      if (gapSize >= minGapPercent && curr.close < curr.open) {
        const filled = candles.slice(i + 1).some((c) => c.high >= bearGapHigh * 0.999);
        fvgs.push({
          id: `bearish_fvg_${i}`,
          type: "bearish",
          priceHigh: Number(bearGapHigh.toFixed(8)),
          priceLow: Number(bearGapLow.toFixed(8)),
          filled,
          createdAt: curr.timestamp,
        });
      }
    }
  }

  return fvgs.filter((f) => !f.filled).slice(-15);
}

export function analyzeMarketStructure(candles: Candle[]): MarketStructureAnalysis {
  if (candles.length < 30) {
    return {
      trend: "ranging",
      internalTrend: "ranging",
      points: [],
      orderBlocks: [],
      fvgs: [],
      hasBOS: false,
      hasCHoCH: false,
      lastBOSPrice: null,
      lastCHoCHPrice: null,
    };
  }

  const { swingHighs, swingLows } = findSwings(candles, 4);
  const { swingHighs: internalHighs, swingLows: internalLows } = findSwings(candles, 2);

  const structurePoints = labelStructure(swingHighs, swingLows);
  const internalPoints = labelStructure(internalHighs, internalLows);

  const trend = classifyTrend(structurePoints);
  const internalTrend = classifyTrend(internalPoints);

  const { points, hasBOS, hasCHoCH, lastBOSPrice, lastCHoCHPrice } = detectBOSCHoCH(
    candles,
    structurePoints,
    trend,
  );

  const orderBlocks = detectOrderBlocks(candles);
  const fvgs = detectFairValueGaps(candles);

  return { trend, internalTrend, points, orderBlocks, fvgs, hasBOS, hasCHoCH, lastBOSPrice, lastCHoCHPrice };
}
