/**
 * Bot Execution Loop — Real + Theoretical Trading
 *
 * In REAL mode: executes on-chain via Storm Trade SDK.
 * In THEORETICAL mode: simulates trades using the exact same P&L math
 * that Storm Trade uses internally — same fees, same price calculation,
 * same margin accounting. No wallet required.
 *
 * Storm Trade fee schedule (mainnet USDT vault, as of 2025):
 *   Open fee  = 0.06% of notional (margin × leverage)
 *   Close fee = 0.06% of notional (margin × leverage)
 *
 * P&L formula (mirrors Storm Trade smart contract):
 *   notional         = margin × leverage
 *   positionSizeBase = notional / entryPrice
 *   rawPnl (long)    = (exitPrice - entryPrice) × positionSizeBase
 *   rawPnl (short)   = (entryPrice - exitPrice) × positionSizeBase
 *   netPnl           = rawPnl - openFee - closeFee
 *   pnlPercent       = netPnl / margin × 100
 *
 * Balance accounting (matches Storm Trade margin accounting):
 *   at open  → balance -= (margin + openFee)
 *   at close → balance += (margin + rawPnl - closeFee)
 *   net      → balance += netPnl
 */

import {
  db,
  botStateTable,
  botConfigTable,
  positionsTable,
  tradesTable,
  logsTable,
  riskLimitsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { generateSignal } from "../engine/signals.js";
import { generateOhlcv, getCurrentPrice } from "../engine/marketData.js";
import { openPosition, closePosition } from "./stormExecutor.js";
import { getWalletAddress } from "./walletService.js";
import { logger } from "../lib/logger.js";
import type { EntryFilters } from "../engine/signals.js";

// ── Storm Trade constants ─────────────────────────────────────────────────────
const STORM_OPEN_FEE_RATE  = 0.0006; // 0.06% of notional
const STORM_CLOSE_FEE_RATE = 0.0006; // 0.06% of notional

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dbLog(level: string, message: string, category: string, metadata?: object) {
  try {
    await db.insert(logsTable).values({
      id: crypto.randomUUID(),
      level,
      message,
      category,
      metadata: metadata ?? null,
    });
    logger.info({ category }, message);
  } catch (err) {
    logger.error({ err }, "dbLog insert failed");
  }
}

/**
 * Exact Storm Trade P&L math.
 */
function calcPnl(
  side: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  sizeUsd: number,   // notional = margin × leverage
  leverage: number,
) {
  const positionSizeBase = sizeUsd / entryPrice;
  const rawPnl =
    side === "long"
      ? (exitPrice - entryPrice) * positionSizeBase
      : (entryPrice - exitPrice) * positionSizeBase;

  const openFee  = sizeUsd * STORM_OPEN_FEE_RATE;
  const closeFee = sizeUsd * STORM_CLOSE_FEE_RATE;
  const netPnl   = rawPnl - openFee - closeFee;
  const margin   = sizeUsd / leverage;
  const pnlPct   = (netPnl / margin) * 100;

  return { rawPnl, openFee, closeFee, netPnl, pnlPct, margin };
}

// ── Position monitor ──────────────────────────────────────────────────────────

async function monitorOpenPositions(isTheoretical: boolean) {
  const positions = await db.select().from(positionsTable);
  if (positions.length === 0) return;

  for (const pos of positions) {
    // Only monitor positions that match the current mode
    if (!!pos.isTheoretical !== isTheoretical) continue;

    try {
      const priceData    = await getCurrentPrice(pos.pair);
      const currentPrice = priceData.price;
      const side         = pos.side as "long" | "short";
      const sl           = Number(pos.stopLoss);
      const tp           = Number(pos.takeProfit);
      const entry        = Number(pos.entryPrice);
      const leverage     = Number(pos.leverage);
      const sizeUsd      = Number(pos.sizeUsd);

      const hitSl = side === "long" ? currentPrice <= sl : currentPrice >= sl;
      const hitTp = side === "long" ? currentPrice >= tp : currentPrice <= tp;

      if (hitSl || hitTp) {
        const exitReason = hitTp ? "take_profit" : "stop_loss";
        const { rawPnl, openFee, closeFee, netPnl, pnlPct, margin } = calcPnl(
          side, entry, currentPrice, sizeUsd, leverage,
        );
        const modeTag = isTheoretical ? "[SIM] " : "";

        await dbLog(
          hitTp ? "info" : "warn",
          `${modeTag}[POSITION ${exitReason.toUpperCase()}] ${pos.pair} ${side} | Entry: ${entry} → Exit: ${currentPrice} | Net PnL: $${netPnl.toFixed(2)} (${pnlPct.toFixed(2)}%) | Fees: $${(openFee + closeFee).toFixed(4)}`,
          "position",
          { posId: pos.id, entryPrice: entry, exitPrice: currentPrice, rawPnl, netPnl, pnlPct, openFee, closeFee, exitReason, isTheoretical },
        );

        // Real mode: close on-chain
        if (!isTheoretical) {
          try {
            await closePosition({ pair: pos.pair, direction: side, size: Number(pos.size) });
          } catch (err) {
            await dbLog("error", `On-chain close failed: ${err}`, "position", { error: String(err) });
          }
        }

        // Record closed trade
        await db.insert(tradesTable).values({
          id: crypto.randomUUID(),
          pair: pos.pair,
          side,
          entryPrice: pos.entryPrice,
          exitPrice: currentPrice.toFixed(8),
          size: pos.size,
          sizeUsd: pos.sizeUsd,
          leverage: pos.leverage,
          realizedPnlUsd: netPnl.toFixed(4),
          realizedPnlPercent: pnlPct.toFixed(4),
          openFeeUsd: openFee.toFixed(4),
          closeFeeUsd: closeFee.toFixed(4),
          openedAt: pos.openedAt,
          closedAt: new Date(),
          exitReason,
          confluenceScore: "0",
          isTheoretical,
        });

        await db.delete(positionsTable).where(eq(positionsTable.id, pos.id));

        // Update bot state
        const [stateRow] = await db.select().from(botStateTable).limit(1);
        if (stateRow) {
          const newDailyPnl = Number(stateRow.dailyPnlUsd) + netPnl;
          const updates: Record<string, unknown> = {
            dailyPnlUsd: newDailyPnl.toFixed(4),
            updatedAt: new Date(),
          };

          // In theoretical mode: at close → balance += margin + rawPnl - closeFee
          if (isTheoretical && stateRow.theoreticalBalance != null) {
            const newBalance = Number(stateRow.theoreticalBalance) + margin + rawPnl - closeFee;
            updates.theoreticalBalance = newBalance.toFixed(4);
          }

          await db.update(botStateTable).set(updates).where(eq(botStateTable.id, stateRow.id));
        }
      } else {
        // Update unrealised PnL
        const { netPnl: unrlUsd, pnlPct: unrlPct } = calcPnl(
          side, entry, currentPrice, sizeUsd, leverage,
        );

        await db
          .update(positionsTable)
          .set({
            currentPrice: currentPrice.toFixed(8),
            unrealizedPnlUsd: unrlUsd.toFixed(4),
            unrealizedPnlPercent: unrlPct.toFixed(4),
          })
          .where(eq(positionsTable.id, pos.id));
      }
    } catch (err) {
      logger.error({ err, posId: pos.id }, "Error monitoring position");
    }
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────

async function runTick() {
  if (_running) return;
  _running = true;

  try {
    const [state] = await db.select().from(botStateTable).limit(1);
    if (!state || state.state !== "running") return;

    const isTheoretical = state.theoreticalMode;

    // Real mode: require wallet
    if (!isTheoretical) {
      const walletAddr = await getWalletAddress();
      if (!walletAddr) {
        await dbLog(
          "warn",
          "Bot is running but no wallet is connected. Import your mnemonic seed phrase.",
          "system",
        );
        return;
      }
    }

    // Theoretical mode: require sufficient virtual balance
    if (isTheoretical && (state.theoreticalBalance == null || Number(state.theoreticalBalance) < 5)) {
      await dbLog(
        "warn",
        `[SIM] Theoretical balance exhausted ($${Number(state.theoreticalBalance ?? 0).toFixed(2)}). Bot stopping.`,
        "system",
      );
      await db
        .update(botStateTable)
        .set({ state: "stopped", updatedAt: new Date() })
        .where(eq(botStateTable.id, state.id));
      return;
    }

    const [config] = await db.select().from(botConfigTable).limit(1);
    if (!config) return;

    const [risks] = await db.select().from(riskLimitsTable).limit(1);
    if (!risks || !risks.enabled) {
      await dbLog("info", "Risk management disabled — bot halted for safety", "risk");
      return;
    }

    // Daily loss guard
    const dailyPnl      = Number(state.dailyPnlUsd);
    const maxDailyLoss  = Number(risks.maxDailyLossUsd);
    if (dailyPnl <= -maxDailyLoss) {
      await dbLog(
        "warn",
        `${isTheoretical ? "[SIM] " : ""}Daily loss limit reached ($${(-dailyPnl).toFixed(2)} / $${maxDailyLoss}). Bot paused.`,
        "risk",
      );
      await db
        .update(botStateTable)
        .set({ state: "paused", updatedAt: new Date() })
        .where(eq(botStateTable.id, state.id));
      return;
    }

    // Monitor existing positions first
    await monitorOpenPositions(isTheoretical);

    // Count open positions for current mode
    const allPositions  = await db.select().from(positionsTable);
    const modePositions = allPositions.filter((p) => !!p.isTheoretical === isTheoretical);
    const openCount     = modePositions.length;
    const maxOpen       = risks.maxOpenPositions;

    if (openCount >= maxOpen) {
      logger.info({ openCount, maxOpen }, "At max open positions — skipping signal scan");
      await db
        .update(botStateTable)
        .set({ lastSignalAt: new Date(), updatedAt: new Date() })
        .where(eq(botStateTable.id, state.id));
      return;
    }

    const pair = config.pair;

    // Skip if already holding this pair in current mode
    const existingInPair = modePositions.filter((p) => p.pair === pair);
    if (existingInPair.length > 0) {
      logger.info({ pair }, "Already have open position in pair — skipping entry");
      return;
    }

    const modeTag = isTheoretical ? "[SIM] " : "";

    // Fetch live candles
    await dbLog("info", `${modeTag}Fetching live candles: ${pair} [${config.interval}]`, "market");

    let candles;
    try {
      candles = await generateOhlcv(pair, config.interval, 200);
    } catch (err) {
      await dbLog("error", `${modeTag}Failed to fetch candles: ${err}`, "market", { error: String(err) });
      return;
    }

    if (candles.length < 50) {
      await dbLog("warn", `${modeTag}Insufficient candle data (${candles.length} candles)`, "market");
      return;
    }

    // Run SMC Signal Engine
    const filters = (config.entryFilters as EntryFilters | null) ?? undefined;
    const signal  = generateSignal(pair, candles, filters);

    await db
      .update(botStateTable)
      .set({ lastSignalAt: new Date(), activePair: pair, updatedAt: new Date() })
      .where(eq(botStateTable.id, state.id));

    await dbLog(
      "info",
      `${modeTag}[SIGNAL] ${pair} → ${signal.signal.toUpperCase()} (${signal.confluenceScore}/100) | ${signal.reasoning}`,
      "signal",
      { pair, signal: signal.signal, score: signal.confluenceScore, entry: signal.suggestedEntry, sl: signal.suggestedStopLoss, tp: signal.suggestedTakeProfit, rr: signal.riskReward, isTheoretical },
    );

    if (signal.signal === "neutral") return;
    if (!signal.suggestedEntry || !signal.suggestedStopLoss || !signal.suggestedTakeProfit) return;

    // ── Risk sizing ────────────────────────────────────────────────────────────
    const leverage  = Math.min(Number(risks.maxLeverage), 5);
    const direction = signal.signal.includes("long") ? "long" : "short";

    let margin: number;
    if (isTheoretical) {
      // Size at 10% of current virtual balance, capped at maxPositionSizeUsd
      const avail = Number(state.theoreticalBalance!);
      margin = Math.min(avail * 0.10, Number(risks.maxPositionSizeUsd));
      margin = Math.max(margin, 1);
    } else {
      margin = Number(risks.maxPositionSizeUsd);
    }

    const sizeUsd = margin * leverage; // notional
    const openFee = sizeUsd * STORM_OPEN_FEE_RATE;
    const entry   = signal.suggestedEntry;
    const posSize = sizeUsd / entry;

    await dbLog(
      "info",
      `${modeTag}[ORDER] Opening ${direction.toUpperCase()} ${pair} | Margin: $${margin.toFixed(2)} × ${leverage}x = $${sizeUsd.toFixed(2)} notional | Open fee: $${openFee.toFixed(4)} | Entry: ${entry} | SL: ${signal.suggestedStopLoss} | TP: ${signal.suggestedTakeProfit}`,
      "order",
      { pair, direction, margin, leverage, sizeUsd, openFee, entry, sl: signal.suggestedStopLoss, tp: signal.suggestedTakeProfit, rr: signal.riskReward, isTheoretical },
    );

    try {
      if (!isTheoretical) {
        // Real execution via Storm Trade SDK
        await openPosition({
          pair,
          direction,
          amountUsdt: margin,
          leverage,
          stopLoss:   signal.suggestedStopLoss,
          takeProfit: signal.suggestedTakeProfit,
        });
      } else {
        // Theoretical: deduct margin + openFee from virtual balance
        const [freshState] = await db.select().from(botStateTable).limit(1);
        if (!freshState || freshState.theoreticalBalance == null) return;
        const newBalance = Number(freshState.theoreticalBalance) - margin - openFee;
        await db
          .update(botStateTable)
          .set({ theoreticalBalance: newBalance.toFixed(4), updatedAt: new Date() })
          .where(eq(botStateTable.id, freshState.id));
      }

      // Record position in DB
      await db.insert(positionsTable).values({
        id: crypto.randomUUID(),
        pair,
        side: direction,
        entryPrice: entry.toFixed(8),
        currentPrice: entry.toFixed(8),
        size: posSize.toFixed(8),
        sizeUsd: sizeUsd.toFixed(4),
        leverage: leverage.toFixed(2),
        stopLoss:    signal.suggestedStopLoss.toFixed(8),
        takeProfit:  signal.suggestedTakeProfit.toFixed(8),
        entryReason: signal.reasoning.slice(0, 500),
        isTheoretical,
      });

      await db
        .update(botStateTable)
        .set({ totalTrades: state.totalTrades + 1, updatedAt: new Date() })
        .where(eq(botStateTable.id, state.id));

      await dbLog(
        "info",
        `${modeTag}[POSITION OPENED] ${direction.toUpperCase()} ${pair} @ ${entry} | SL: ${signal.suggestedStopLoss} | TP: ${signal.suggestedTakeProfit}`,
        "position",
        { pair, direction, entry, margin, sizeUsd, openFee, leverage, sl: signal.suggestedStopLoss, tp: signal.suggestedTakeProfit, isTheoretical },
      );
    } catch (err) {
      await dbLog("error", `${modeTag}[ORDER FAILED] ${err}`, "order", { error: String(err) });
    }
  } catch (err) {
    logger.error({ err }, "Bot tick uncaught error");
  } finally {
    _running = false;
  }
}

// ── Loop control ──────────────────────────────────────────────────────────────

export function startBotLoop(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { void runTick(); }, intervalMs);
  void runTick();
  logger.info({ intervalMs }, "Bot execution loop started");
}

export function stopBotLoop(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  logger.info("Bot execution loop stopped");
}

export { runTick };
