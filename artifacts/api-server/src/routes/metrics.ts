import { Router } from "express";
import { db, tradesTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/metrics/summary", async (req, res) => {
  try {
    const trades = await db.select().from(tradesTable).orderBy(desc(tradesTable.closedAt));

    if (trades.length === 0) {
      res.json({
        totalPnlUsd: 0,
        totalPnlPercent: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        bestTradeUsd: 0,
        worstTradeUsd: 0,
        avgWinUsd: 0,
        avgLossUsd: 0,
        profitFactor: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        avgHoldingHours: 0,
      });
      return;
    }

    const pnls = trades.map((t) => Number(t.realizedPnlUsd));
    const winners = pnls.filter((p) => p > 0);
    const losers = pnls.filter((p) => p < 0);
    const totalPnl = pnls.reduce((s, p) => s + p, 0);
    const grossProfit = winners.reduce((s, p) => s + p, 0);
    const grossLoss = Math.abs(losers.reduce((s, p) => s + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

    const holdingHours = trades.map((t) => {
      const diff = new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
      return diff / 3_600_000;
    });
    const avgHolding = holdingHours.reduce((s, h) => s + h, 0) / holdingHours.length;

    // Simple max drawdown calculation
    let peak = 0;
    let maxDrawdown = 0;
    let equity = 0;
    for (const pnl of pnls) {
      equity += pnl;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Simplified Sharpe (annualized, assuming ~252 trading days)
    const mean = pnls.reduce((s, p) => s + p, 0) / pnls.length;
    const variance = pnls.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / pnls.length;
    const stddev = Math.sqrt(variance);
    const sharpe = stddev > 0 ? (mean / stddev) * Math.sqrt(252) : 0;

    res.json({
      totalPnlUsd: Number(totalPnl.toFixed(4)),
      totalPnlPercent: 0,
      winRate: Number(((winners.length / trades.length) * 100).toFixed(2)),
      totalTrades: trades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      bestTradeUsd: Number(Math.max(...pnls).toFixed(4)),
      worstTradeUsd: Number(Math.min(...pnls).toFixed(4)),
      avgWinUsd: winners.length > 0 ? Number((grossProfit / winners.length).toFixed(4)) : 0,
      avgLossUsd: losers.length > 0 ? Number((grossLoss / losers.length).toFixed(4)) : 0,
      profitFactor: Number(profitFactor.toFixed(2)),
      maxDrawdownPercent: Number(maxDrawdown.toFixed(2)),
      sharpeRatio: Number(sharpe.toFixed(2)),
      avgHoldingHours: Number(avgHolding.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/metrics/performance", async (req, res) => {
  try {
    const period = (req.query.period as string) || "30d";
    const trades = await db.select().from(tradesTable).orderBy(desc(tradesTable.closedAt));

    // Filter by period
    const cutoffMs: Record<string, number> = {
      "1d": 86_400_000,
      "7d": 7 * 86_400_000,
      "30d": 30 * 86_400_000,
      all: Infinity,
    };
    const cutoff = Date.now() - (cutoffMs[period] ?? Infinity);
    const filtered = trades.filter((t) => new Date(t.closedAt).getTime() >= cutoff);

    // Build equity curve
    let equity = 1000;
    const equityCurve = filtered.reverse().map((t) => {
      equity += Number(t.realizedPnlUsd);
      let runningPeak = 1000;
      const drawdown = equity < runningPeak ? ((runningPeak - equity) / runningPeak) * 100 : 0;
      return {
        timestamp: new Date(t.closedAt).toISOString(),
        equityUsd: Number(equity.toFixed(2)),
        drawdownPercent: Number(drawdown.toFixed(2)),
      };
    });

    // P&L by day
    const byDay: Record<string, { pnl: number; trades: number }> = {};
    for (const t of filtered) {
      const day = new Date(t.closedAt).toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { pnl: 0, trades: 0 };
      byDay[day].pnl += Number(t.realizedPnlUsd);
      byDay[day].trades += 1;
    }
    const pnlByDay = Object.entries(byDay).map(([date, d]) => ({
      date,
      pnlUsd: Number(d.pnl.toFixed(4)),
      trades: d.trades,
    }));

    // Win rate by pair
    const byPair: Record<string, { wins: number; total: number; pnl: number }> = {};
    for (const t of filtered) {
      if (!byPair[t.pair]) byPair[t.pair] = { wins: 0, total: 0, pnl: 0 };
      byPair[t.pair].total += 1;
      if (Number(t.realizedPnlUsd) > 0) byPair[t.pair].wins += 1;
      byPair[t.pair].pnl += Number(t.realizedPnlUsd);
    }
    const winRateByPair = Object.entries(byPair).map(([pair, s]) => ({
      pair,
      winRate: Number(((s.wins / s.total) * 100).toFixed(2)),
      trades: s.total,
      pnlUsd: Number(s.pnl.toFixed(4)),
    }));

    res.json({ period, equityCurve, pnlByDay, winRateByPair });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
