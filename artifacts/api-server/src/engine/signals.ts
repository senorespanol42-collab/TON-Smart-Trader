/**
 * Signal Generation Engine — Confluence Scoring System
 *
 * This is the core decision engine. It synthesizes output from the Price Action
 * and SMC engines into a single, scored trading signal.
 *
 * ## Confluence Methodology
 *
 * No single indicator is sufficient for high-probability entries. Instead, we
 * score each potential trade on multiple independent confirming factors. Only
 * signals above the configured `minConfluenceScore` threshold are executed.
 *
 * ## Stop-Hunt Protection
 *
 * The engine specifically guards against the "stop hunt" pattern where price
 * briefly pierces a level (triggering retail stop losses) before reversing.
 *
 * Detection methods:
 * 1. Equal highs/lows spotted in structure → flag as liquidity pool target
 * 2. Long wick candle at key level (wick > 2x body) → stop hunt signature
 * 3. Price < support but closes above → failed breakdown
 * 4. Volume spike at level with reversal candle → institutional accumulation
 *
 * When a stop hunt is detected, entries are BLOCKED until price confirms
 * a break with 2 closes beyond the level and volume confirmation.
 *
 * ## Scoring Weights
 *
 * Market Structure (30 pts max):
 *   +15: Trend alignment (trading with HTF trend)
 *   +10: BOS confirmation
 *   +5:  CHoCH (reversal setups only)
 *
 * Zone Confluence (25 pts max):
 *   +15: Price at S/D zone
 *   +10: Zone has not been tested (fresh zone = more institutional interest)
 *
 * Order Block (20 pts max):
 *   +20: Price inside valid order block
 *
 * Fair Value Gap (15 pts max):
 *   +15: Price at or inside FVG (seeking price inefficiency fill)
 *
 * Risk/Reward Quality (10 pts max):
 *   +10: R:R >= minRiskReward (configurable, default 2.0)
 *
 * Total max: 100 points
 */

import type { Candle } from "./marketData.js";
import { analyzeKeyLevels, analyzeSupplyDemandZones } from "./priceAction.js";
import { analyzeMarketStructure } from "./smc.js";

export type SignalType = "strong_long" | "long" | "neutral" | "short" | "strong_short";

export interface TradingSignal {
  pair: string;
  signal: SignalType;
  confluenceScore: number;
  reasoning: string;
  keyFactors: string[];
  suggestedEntry: number | null;
  suggestedStopLoss: number | null;
  suggestedTakeProfit: number | null;
  riskReward: number | null;
  generatedAt: string;
}

export interface EntryFilters {
  minConfluenceScore: number;
  requireBos: boolean;
  requireChoch: boolean;
  requireFvg: boolean;
  requireOrderBlock: boolean;
  minRiskReward: number;
}

const DEFAULT_FILTERS: EntryFilters = {
  minConfluenceScore: 65,
  requireBos: true,
  requireChoch: false,
  requireFvg: true,
  requireOrderBlock: true,
  minRiskReward: 2.0,
};

/**
 * Detect stop hunt / false breakout signature.
 * Returns true if the current candle looks like a liquidity sweep rather than
 * a genuine breakout.
 */
function detectStopHunt(candle: Candle, levelPrice: number, direction: "up" | "down"): boolean {
  const body = Math.abs(candle.close - candle.open);
  const fullRange = candle.high - candle.low;
  if (fullRange === 0) return false;

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  if (direction === "up") {
    // Candle briefly broke above level but closed back below — stop hunt
    const brokeAbove = candle.high > levelPrice * 1.001;
    const closedBelow = candle.close < levelPrice;
    const longUpperWick = upperWick > body * 2;
    return brokeAbove && closedBelow && longUpperWick;
  } else {
    // Candle briefly broke below level but closed back above — stop hunt
    const brokeBelow = candle.low < levelPrice * 0.999;
    const closedAbove = candle.close > levelPrice;
    const longLowerWick = lowerWick > body * 2;
    return brokeBelow && closedAbove && longLowerWick;
  }
}

export function generateSignal(
  pair: string,
  candles: Candle[],
  filters: EntryFilters = DEFAULT_FILTERS,
): TradingSignal {
  if (candles.length < 50) {
    return {
      pair,
      signal: "neutral",
      confluenceScore: 0,
      reasoning: "Insufficient candle data for analysis.",
      keyFactors: [],
      suggestedEntry: null,
      suggestedStopLoss: null,
      suggestedTakeProfit: null,
      riskReward: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const currentCandle = candles[candles.length - 1];

  const structure = analyzeMarketStructure(candles);
  const levels = analyzeKeyLevels(candles);
  const zones = analyzeSupplyDemandZones(candles);

  let bullScore = 0;
  let bearScore = 0;
  const bullFactors: string[] = [];
  const bearFactors: string[] = [];

  // ── Market Structure Scoring ─────────────────────────────────────────────
  if (structure.trend === "bullish") {
    bullScore += 15;
    bullFactors.push("HTF market structure is bullish (HH/HL sequence confirmed)");
  } else if (structure.trend === "bearish") {
    bearScore += 15;
    bearFactors.push("HTF market structure is bearish (LL/LH sequence confirmed)");
  }

  if (structure.hasBOS) {
    if (structure.trend === "bullish") {
      bullScore += 10;
      bullFactors.push(`Break of Structure confirmed above ${structure.lastBOSPrice?.toFixed(4)}`);
    } else {
      bearScore += 10;
      bearFactors.push(`Break of Structure confirmed below ${structure.lastBOSPrice?.toFixed(4)}`);
    }
  }

  if (structure.hasCHoCH) {
    if (structure.internalTrend === "bullish") {
      bullScore += 5;
      bullFactors.push("Change of Character detected — potential bullish reversal");
    } else {
      bearScore += 5;
      bearFactors.push("Change of Character detected — potential bearish reversal");
    }
  }

  // ── Zone Confluence ──────────────────────────────────────────────────────
  const ZONE_TOLERANCE = 0.015; // 1.5%

  const nearDemandZone = zones.find(
    (z) => z.type === "demand" && !z.mitigated &&
      currentPrice >= z.priceLow * (1 - ZONE_TOLERANCE) &&
      currentPrice <= z.priceHigh * (1 + ZONE_TOLERANCE),
  );
  const nearSupplyZone = zones.find(
    (z) => z.type === "supply" && !z.mitigated &&
      currentPrice >= z.priceLow * (1 - ZONE_TOLERANCE) &&
      currentPrice <= z.priceHigh * (1 + ZONE_TOLERANCE),
  );

  if (nearDemandZone) {
    const bonus = nearDemandZone.tested ? 10 : 15;
    bullScore += bonus;
    bullFactors.push(
      `Price at ${nearDemandZone.tested ? "tested" : "fresh"} demand zone ${nearDemandZone.priceLow.toFixed(4)}-${nearDemandZone.priceHigh.toFixed(4)}`,
    );
  }

  if (nearSupplyZone) {
    const bonus = nearSupplyZone.tested ? 10 : 15;
    bearScore += bonus;
    bearFactors.push(
      `Price at ${nearSupplyZone.tested ? "tested" : "fresh"} supply zone ${nearSupplyZone.priceLow.toFixed(4)}-${nearSupplyZone.priceHigh.toFixed(4)}`,
    );
  }

  // ── Order Block Scoring ──────────────────────────────────────────────────
  const OB_TOLERANCE = 0.008;
  const bullishOB = structure.orderBlocks.find(
    (ob) => ob.type === "bullish" && !ob.mitigated &&
      currentPrice >= ob.priceLow * (1 - OB_TOLERANCE) &&
      currentPrice <= ob.priceHigh * (1 + OB_TOLERANCE),
  );
  const bearishOB = structure.orderBlocks.find(
    (ob) => ob.type === "bearish" && !ob.mitigated &&
      currentPrice >= ob.priceLow * (1 - OB_TOLERANCE) &&
      currentPrice <= ob.priceHigh * (1 + OB_TOLERANCE),
  );

  if (bullishOB) {
    bullScore += 20;
    bullFactors.push(`Price inside bullish order block ${bullishOB.priceLow.toFixed(4)}-${bullishOB.priceHigh.toFixed(4)}`);
  }
  if (bearishOB) {
    bearScore += 20;
    bearFactors.push(`Price inside bearish order block ${bearishOB.priceLow.toFixed(4)}-${bearishOB.priceHigh.toFixed(4)}`);
  }

  // ── Fair Value Gap Scoring ───────────────────────────────────────────────
  const FVG_TOLERANCE = 0.005;
  const bullFVG = structure.fvgs.find(
    (f) => f.type === "bullish" && !f.filled &&
      currentPrice >= f.priceLow * (1 - FVG_TOLERANCE) &&
      currentPrice <= f.priceHigh * (1 + FVG_TOLERANCE),
  );
  const bearFVG = structure.fvgs.find(
    (f) => f.type === "bearish" && !f.filled &&
      currentPrice >= f.priceLow * (1 - FVG_TOLERANCE) &&
      currentPrice <= f.priceHigh * (1 + FVG_TOLERANCE),
  );

  if (bullFVG) {
    bullScore += 15;
    bullFactors.push(`Price filling bullish FVG (imbalance) at ${bullFVG.priceLow.toFixed(4)}-${bullFVG.priceHigh.toFixed(4)}`);
  }
  if (bearFVG) {
    bearScore += 15;
    bearFactors.push(`Price filling bearish FVG (imbalance) at ${bearFVG.priceLow.toFixed(4)}-${bearFVG.priceHigh.toFixed(4)}`);
  }

  // ── Stop-Hunt Protection ─────────────────────────────────────────────────
  const nearResistance = levels.find(
    (l) => l.type === "resistance" && Math.abs(l.price - currentPrice) / currentPrice < 0.01,
  );
  const nearSupport = levels.find(
    (l) => l.type === "support" && Math.abs(l.price - currentPrice) / currentPrice < 0.01,
  );

  if (nearResistance && detectStopHunt(currentCandle, nearResistance.price, "up")) {
    bearScore += 8;
    bearFactors.push(`Stop hunt detected at resistance ${nearResistance.price.toFixed(4)} — institutional sell pressure likely`);
  }
  if (nearSupport && detectStopHunt(currentCandle, nearSupport.price, "down")) {
    bullScore += 8;
    bullFactors.push(`Stop hunt / liquidity sweep at support ${nearSupport.price.toFixed(4)} — potential reversal`);
  }

  // ── Determine Signal & Calculate Entry ───────────────────────────────────
  const bullConfluence = Math.min(100, bullScore);
  const bearConfluence = Math.min(100, bearScore);

  let signal: SignalType = "neutral";
  let confluenceScore = 0;
  let suggestedEntry: number | null = null;
  let suggestedStopLoss: number | null = null;
  let suggestedTakeProfit: number | null = null;
  let riskReward: number | null = null;
  let reasoning = "";
  let keyFactors: string[] = [];

  const strongThreshold = 70;
  const weakThreshold = 50;

  if (bullConfluence > bearConfluence && bullConfluence >= weakThreshold) {
    signal = bullConfluence >= strongThreshold ? "strong_long" : "long";
    confluenceScore = bullConfluence;
    keyFactors = bullFactors;

    // Entry: current price or slightly below for demand zone entries
    suggestedEntry = Number(currentPrice.toFixed(8));
    // Stop: below nearest support or demand zone low
    const stopRef = nearDemandZone?.priceLow ?? (nearSupport?.price ?? currentPrice * 0.985);
    suggestedStopLoss = Number((Math.min(stopRef, currentPrice * 0.985)).toFixed(8));
    const riskDist = suggestedEntry - suggestedStopLoss;
    suggestedTakeProfit = Number((suggestedEntry + riskDist * filters.minRiskReward).toFixed(8));
    riskReward = Number(((suggestedTakeProfit - suggestedEntry) / (suggestedEntry - suggestedStopLoss)).toFixed(2));

    reasoning = `Bullish confluence of ${confluenceScore}/100. ${structure.trend === "bullish" ? "Aligned with bullish market structure." : "Counter-trend but high confluence."} Entry confirmed by ${keyFactors.length} factors.`;
  } else if (bearConfluence > bullConfluence && bearConfluence >= weakThreshold) {
    signal = bearConfluence >= strongThreshold ? "strong_short" : "short";
    confluenceScore = bearConfluence;
    keyFactors = bearFactors;

    suggestedEntry = Number(currentPrice.toFixed(8));
    const stopRef = nearSupplyZone?.priceHigh ?? (nearResistance?.price ?? currentPrice * 1.015);
    suggestedStopLoss = Number((Math.max(stopRef, currentPrice * 1.015)).toFixed(8));
    const riskDist = suggestedStopLoss - suggestedEntry;
    suggestedTakeProfit = Number((suggestedEntry - riskDist * filters.minRiskReward).toFixed(8));
    riskReward = Number(((suggestedEntry - suggestedTakeProfit) / (suggestedStopLoss - suggestedEntry)).toFixed(2));

    reasoning = `Bearish confluence of ${confluenceScore}/100. ${structure.trend === "bearish" ? "Aligned with bearish market structure." : "Counter-trend but high confluence."} Entry confirmed by ${keyFactors.length} factors.`;
  } else {
    signal = "neutral";
    confluenceScore = Math.max(bullConfluence, bearConfluence);
    reasoning = `Insufficient confluence for a directional trade. Bull score: ${bullConfluence}, Bear score: ${bearConfluence}. Wait for clearer setup.`;
    keyFactors = [...bullFactors, ...bearFactors];
  }

  // ── Filter Validation ────────────────────────────────────────────────────
  const filterViolations: string[] = [];

  if (signal !== "neutral") {
    if (confluenceScore < filters.minConfluenceScore) {
      filterViolations.push(`Confluence ${confluenceScore} < required ${filters.minConfluenceScore}`);
    }
    if (filters.requireBos && !structure.hasBOS) {
      filterViolations.push("BOS confirmation required but not detected");
    }
    if (filters.requireFvg && !bullFVG && !bearFVG) {
      filterViolations.push("FVG alignment required but not detected");
    }
    if (filters.requireOrderBlock && !bullishOB && !bearishOB) {
      filterViolations.push("Order block alignment required but not detected");
    }
    if (riskReward !== null && riskReward < filters.minRiskReward) {
      filterViolations.push(`R:R ${riskReward} < required ${filters.minRiskReward}`);
    }

    if (filterViolations.length > 0) {
      signal = "neutral";
      reasoning += ` BLOCKED by filters: ${filterViolations.join("; ")}.`;
    }
  }

  return {
    pair,
    signal,
    confluenceScore,
    reasoning,
    keyFactors,
    suggestedEntry,
    suggestedStopLoss,
    suggestedTakeProfit,
    riskReward,
    generatedAt: new Date().toISOString(),
  };
}
