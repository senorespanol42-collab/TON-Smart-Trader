/**
 * Bot Execution Loop — Real Automated Trading
 *
 * Runs on a configurable interval, fetches live candles from Binance,
 * runs SMC signal analysis, and executes real positions on Storm Trade
 * when high-confluence signals are detected.
 *
 * Also monitors open positions and closes them when SL/TP is hit.
 */

import { db, botStateTable, botConfigTable, positionsTable, tradesTable, logsTable, riskLimitsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import crypto from "crypto";
import { generateSignal } from "../engine/signals.js";
import { generateOhlcv, getCurrentPrice } from "../engine/marketData.js";
import { openPosition, closePosition } from "./stormExecutor.js";
import { getWalletAddress } from "./walletService.js";
import { logger } from "../lib/logger.js";
import type { EntryFilters } from "../engine/signals.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;

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

async function monitorOpenPositions() {
  const positions = await db.select().from(positionsTable);
  if (positions.length === 0) return;

  for (const pos of positions) {
    try {
      const priceData = await getCurrentPrice(pos.pair);
      const currentPrice = priceData.price;
      const side = pos.side as "long" | "short";
      const sl = Number(pos.stopLoss);
      const tp = Number(pos.takeProfit);
      const entry = Number(pos.entryPrice);
      const leverage = Number(pos.leverage);
      const sizeUsd = Number(pos.sizeUsd);

      const hitSl = side === "long" ? currentPrice <= sl : currentPrice >= sl;
      const hitTp = side === "long" ? currentPrice >= tp : currentPrice <= tp;

      if (hitSl || hitTp) {
        const exitReason = hitTp ? "take_profit" : "stop_loss";
        const pnlPct =
          side === "long"
            ? ((currentPrice - entry) / entry) * 100 * leverage
            : ((entry - currentPrice) / entry) * 100 * leverage;
        const pnlUsd = (pnlPct / 100) * sizeUsd;

        await dbLog(
          hitTp ? "info" : "warn",
          `[POSITION ${exitReason.toUpperCase()}] ${pos.pair} ${side} | Entry: ${entry} → Exit: ${currentPrice} | PnL: $${pnlUsd.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
          "position",
          { posId: pos.id, entryPrice: entry, exitPrice: currentPrice, pnlUsd, pnlPct, exitReason },
        );

        // Close real on-chain position
        try {
          await closePosition({ pair: pos.pair, direction: side, size: Number(pos.size) });
        } catch (err) {
          await dbLog("error", `On-chain close failed: ${err}`, "position", { error: String(err) });
        }

        // Record in trades table
        await db.insert(tradesTable).values({
          id: crypto.randomUUID(),
          pair: pos.pair,
          side,
          entryPrice: pos.entryPrice,
          exitPrice: currentPrice.toFixed(8),
          size: pos.size,
          sizeUsd: pos.sizeUsd,
          leverage: pos.leverage,
          realizedPnlUsd: pnlUsd.toFixed(4),
          realizedPnlPercent: pnlPct.toFixed(4),
          openedAt: pos.openedAt,
          closedAt: new Date(),
          exitReason,
          confluenceScore: "0",
        });

        await db.delete(positionsTable).where(eq(positionsTable.id, pos.id));

        // Update daily PnL
        const [stateRow] = await db.select().from(botStateTable).limit(1);
        if (stateRow) {
          await db
            .update(botStateTable)
            .set({ dailyPnlUsd: (Number(stateRow.dailyPnlUsd) + pnlUsd).toFixed(4), updatedAt: new Date() })
            .where(eq(botStateTable.id, stateRow.id));
        }
      } else {
        // Update unrealised PnL in DB
        const unrlPct =
          side === "long"
            ? ((currentPrice - entry) / entry) * 100 * leverage
            : ((entry - currentPrice) / entry) * 100 * leverage;
        const unrlUsd = (unrlPct / 100) * sizeUsd;

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

async function runTick() {
  if (_running) return;
  _running = true;

  try {
    // ── Sanity checks ────────────────────────────────────────────────────────
    const [state] = await db.select().from(botStateTable).limit(1);
    if (!state || state.state !== "running") return;

    const walletAddr = await getWalletAddress();
    if (!walletAddr) {
      await dbLog("warn", "Bot is running but no wallet is connected. Import your mnemonic seed phrase.", "system");
      return;
    }

    const [config] = await db.select().from(botConfigTable).limit(1);
    if (!config) return;

    const [risks] = await db.select().from(riskLimitsTable).limit(1);
    if (!risks || !risks.enabled) {
      await dbLog("info", "Risk management disabled — bot halted for safety", "risk");
      return;
    }

    // ── Daily loss guard ────────────────────────────────────────────────────
    const dailyPnl = Number(state.dailyPnlUsd);
    const maxDailyLoss = Number(risks.maxDailyLossUsd);
    if (dailyPnl <= -maxDailyLoss) {
      await dbLog("warn", `Daily loss limit reached ($${(-dailyPnl).toFixed(2)} / $${maxDailyLoss}). Bot paused.`, "risk");
      await db.update(botStateTable).set({ state: "paused", updatedAt: new Date() }).where(eq(botStateTable.id, state.id));
      return;
    }

    // ── Monitor existing positions first ───────────────────────────────────
    await monitorOpenPositions();

    // ── Open position count ─────────────────────────────────────────────────
    const [{ openCount }] = await db
      .select({ openCount: count() })
      .from(positionsTable);

    const maxOpen = risks.maxOpenPositions;

    // ── Skip if already at max positions ───────────────────────────────────
    if (openCount >= maxOpen) {
      logger.info({ openCount, maxOpen }, "At max open positions — skipping signal scan");
      await db.update(botStateTable).set({ lastSignalAt: new Date(), updatedAt: new Date() }).where(eq(botStateTable.id, state.id));
      return;
    }

    // ── Check if already in this pair ──────────────────────────────────────
    const pair = config.pair;
    const existingInPair = await db.select().from(positionsTable).where(eq(positionsTable.pair, pair));
    if (existingInPair.length > 0) {
      logger.info({ pair }, "Already have open position in pair — skipping entry");
      return;
    }

    // ── Fetch real candles from Binance ────────────────────────────────────
    await dbLog("info", `Fetching live candles: ${pair} [${config.interval}] from Binance`, "market");

    let candles;
    try {
      candles = await generateOhlcv(pair, config.interval, 200);
    } catch (err) {
      await dbLog("error", `Failed to fetch candles: ${err}`, "market", { error: String(err) });
      return;
    }

    if (candles.length < 50) {
      await dbLog("warn", `Insufficient candle data (${candles.length} candles) — need at least 50`, "market");
      return;
    }

    // ── Run SMC Signal Engine ───────────────────────────────────────────────
    const filters = (config.entryFilters as EntryFilters | null) ?? undefined;
    const signal = generateSignal(pair, candles, filters);

    await db.update(botStateTable).set({ lastSignalAt: new Date(), activePair: pair, updatedAt: new Date() }).where(eq(botStateTable.id, state.id));

    await dbLog(
      signal.signal === "neutral" ? "info" : signal.signal.includes("strong") ? "info" : "info",
      `[SIGNAL] ${pair} → ${signal.signal.toUpperCase()} (${signal.confluenceScore}/100) | ${signal.reasoning}`,
      "signal",
      {
        pair,
        signal: signal.signal,
        score: signal.confluenceScore,
        entry: signal.suggestedEntry,
        sl: signal.suggestedStopLoss,
        tp: signal.suggestedTakeProfit,
        rr: signal.riskReward,
        factors: signal.keyFactors,
      },
    );

    // ── Gate: only trade on actionable signals ──────────────────────────────
    if (signal.signal === "neutral") return;
    if (!signal.suggestedEntry || !signal.suggestedStopLoss || !signal.suggestedTakeProfit) return;

    // ── Risk sizing ─────────────────────────────────────────────────────────
    const maxPositionUsd = Number(risks.maxPositionSizeUsd);
    const leverage = Math.min(Number(risks.maxLeverage), 5); // hard cap at 5x
    const marginUsdt = maxPositionUsd; // margin = position size / leverage
    const direction = signal.signal.includes("long") ? "long" : "short";

    await dbLog(
      "info",
      `[ORDER] Opening ${direction.toUpperCase()} ${pair} | Margin: $${marginUsdt} × ${leverage}x | Entry: ${signal.suggestedEntry} | SL: ${signal.suggestedStopLoss} | TP: ${signal.suggestedTakeProfit} | R:R ${signal.riskReward}`,
      "order",
      {
        pair,
        direction,
        marginUsdt,
        leverage,
        entry: signal.suggestedEntry,
        sl: signal.suggestedStopLoss,
        tp: signal.suggestedTakeProfit,
        rr: signal.riskReward,
        score: signal.confluenceScore,
      },
    );

    try {
      // ── Execute real Storm Trade position ───────────────────────────────
      await openPosition({
        pair,
        direction,
        amountUsdt: marginUsdt,
        leverage,
        stopLoss: signal.suggestedStopLoss,
        takeProfit: signal.suggestedTakeProfit,
      });

      // ── Record in local DB for tracking ────────────────────────────────
      const entry = signal.suggestedEntry;
      const posSize = (marginUsdt * leverage) / entry;

      await db.insert(positionsTable).values({
        id: crypto.randomUUID(),
        pair,
        side: direction,
        entryPrice: entry.toFixed(8),
        currentPrice: entry.toFixed(8),
        size: posSize.toFixed(8),
        sizeUsd: (marginUsdt * leverage).toFixed(4),
        leverage: leverage.toFixed(2),
        stopLoss: signal.suggestedStopLoss.toFixed(8),
        takeProfit: signal.suggestedTakeProfit.toFixed(8),
        entryReason: signal.reasoning.slice(0, 500),
      });

      await db
        .update(botStateTable)
        .set({ totalTrades: state.totalTrades + 1, updatedAt: new Date() })
        .where(eq(botStateTable.id, state.id));

      await dbLog(
        "info",
        `[POSITION OPENED] ${direction.toUpperCase()} ${pair} @ ${entry} | SL: ${signal.suggestedStopLoss} | TP: ${signal.suggestedTakeProfit}`,
        "position",
        { pair, direction, entry, marginUsdt, leverage, sl: signal.suggestedStopLoss, tp: signal.suggestedTakeProfit },
      );
    } catch (err) {
      await dbLog("error", `[ORDER FAILED] Failed to open position: ${err}`, "order", { error: String(err) });
    }
  } catch (err) {
    logger.error({ err }, "Bot tick uncaught error");
  } finally {
    _running = false;
  }
}

export function startBotLoop(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { void runTick(); }, intervalMs);
  void runTick(); // fire immediately on start
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
