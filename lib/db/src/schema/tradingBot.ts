import {
  pgTable,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Risk Limits ──────────────────────────────────────────────────────────────
export const riskLimitsTable = pgTable("risk_limits", {
  id: serial("id").primaryKey(),
  maxDailyLossUsd: numeric("max_daily_loss_usd", { precision: 20, scale: 4 }).notNull().default("100"),
  maxPositionSizeUsd: numeric("max_position_size_usd", { precision: 20, scale: 4 }).notNull().default("50"),
  maxOpenPositions: integer("max_open_positions").notNull().default(3),
  maxLeverage: numeric("max_leverage", { precision: 6, scale: 2 }).notNull().default("5"),
  stopLossPercent: numeric("stop_loss_percent", { precision: 6, scale: 2 }).notNull().default("1.5"),
  takeProfitPercent: numeric("take_profit_percent", { precision: 6, scale: 2 }).notNull().default("3.0"),
  maxDrawdownPercent: numeric("max_drawdown_percent", { precision: 6, scale: 2 }).notNull().default("10"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRiskLimitsSchema = createInsertSchema(riskLimitsTable).omit({ id: true, updatedAt: true });
export type InsertRiskLimits = z.infer<typeof insertRiskLimitsSchema>;
export type RiskLimits = typeof riskLimitsTable.$inferSelect;

// ── Bot State ─────────────────────────────────────────────────────────────────
export const botStateTable = pgTable("bot_state", {
  id: serial("id").primaryKey(),
  state: text("state").notNull().default("stopped"), // running | stopped | paused | error
  activePair: text("active_pair"),
  startedAt: timestamp("started_at"),
  dailyPnlUsd: numeric("daily_pnl_usd", { precision: 20, scale: 4 }).notNull().default("0"),
  totalTrades: integer("total_trades").notNull().default(0),
  errorMessage: text("error_message"),
  lastSignalAt: timestamp("last_signal_at"),
  theoreticalMode: boolean("theoretical_mode").notNull().default(false),
  theoreticalBalance: numeric("theoretical_balance", { precision: 20, scale: 4 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotState = typeof botStateTable.$inferSelect;

// ── Bot Config ────────────────────────────────────────────────────────────────
export const botConfigTable = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull().default("TON/USDT"),
  interval: text("interval").notNull().default("1h"),
  strategy: text("strategy").notNull().default("moderate"),
  entryFilters: jsonb("entry_filters").notNull().default({
    minConfluenceScore: 65,
    requireBos: true,
    requireChoch: false,
    requireFvg: true,
    requireOrderBlock: true,
    minRiskReward: 2.0,
  }),
  exitRules: jsonb("exit_rules").notNull().default({
    trailingStop: true,
    partialTakeProfit: true,
    trailingStopActivationPercent: 1.5,
    partialTakeProfitPercent: 50,
  }),
  smcEnabled: boolean("smc_enabled").notNull().default(true),
  priceActionEnabled: boolean("price_action_enabled").notNull().default(true),
  volumeFilter: boolean("volume_filter").notNull().default(true),
  sessionFilter: boolean("session_filter").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotConfig = typeof botConfigTable.$inferSelect;

// ── Positions ─────────────────────────────────────────────────────────────────
export const positionsTable = pgTable("positions", {
  id: text("id").primaryKey(),
  pair: text("pair").notNull(),
  side: text("side").notNull(), // long | short
  entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
  currentPrice: numeric("current_price", { precision: 20, scale: 8 }).notNull(),
  size: numeric("size", { precision: 20, scale: 8 }).notNull(),
  sizeUsd: numeric("size_usd", { precision: 20, scale: 4 }).notNull(),
  leverage: numeric("leverage", { precision: 6, scale: 2 }).notNull(),
  unrealizedPnlUsd: numeric("unrealized_pnl_usd", { precision: 20, scale: 4 }).notNull().default("0"),
  unrealizedPnlPercent: numeric("unrealized_pnl_percent", { precision: 10, scale: 4 }).notNull().default("0"),
  stopLoss: numeric("stop_loss", { precision: 20, scale: 8 }).notNull(),
  takeProfit: numeric("take_profit", { precision: 20, scale: 8 }).notNull(),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  entryReason: text("entry_reason").notNull().default(""),
  txHash: text("tx_hash"),
  isTheoretical: boolean("is_theoretical").notNull().default(false),
});

export type Position = typeof positionsTable.$inferSelect;

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  pair: text("pair").notNull(),
  side: text("side").notNull(), // long | short
  type: text("type").notNull(), // limit | market | stop
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  size: numeric("size", { precision: 20, scale: 8 }).notNull(),
  sizeUsd: numeric("size_usd", { precision: 20, scale: 4 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
});

export type Order = typeof ordersTable.$inferSelect;

// ── Trades ────────────────────────────────────────────────────────────────────
export const tradesTable = pgTable("trades", {
  id: text("id").primaryKey(),
  pair: text("pair").notNull(),
  side: text("side").notNull(),
  entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
  exitPrice: numeric("exit_price", { precision: 20, scale: 8 }).notNull(),
  size: numeric("size", { precision: 20, scale: 8 }).notNull(),
  sizeUsd: numeric("size_usd", { precision: 20, scale: 4 }).notNull(),
  leverage: numeric("leverage", { precision: 6, scale: 2 }).notNull(),
  realizedPnlUsd: numeric("realized_pnl_usd", { precision: 20, scale: 4 }).notNull(),
  realizedPnlPercent: numeric("realized_pnl_percent", { precision: 10, scale: 4 }).notNull(),
  openFeeUsd: numeric("open_fee_usd", { precision: 20, scale: 4 }).notNull().default("0"),
  closeFeeUsd: numeric("close_fee_usd", { precision: 20, scale: 4 }).notNull().default("0"),
  openedAt: timestamp("opened_at").notNull(),
  closedAt: timestamp("closed_at").notNull().defaultNow(),
  exitReason: text("exit_reason").notNull().default("manual"),
  confluenceScore: numeric("confluence_score", { precision: 6, scale: 2 }).notNull().default("0"),
  txHash: text("tx_hash"),
  isTheoretical: boolean("is_theoretical").notNull().default(false),
});

export type Trade = typeof tradesTable.$inferSelect;

// ── Logs ──────────────────────────────────────────────────────────────────────
export const logsTable = pgTable("logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  level: text("level").notNull().default("info"), // info | warn | error | debug
  message: text("message").notNull(),
  category: text("category").notNull().default("system"), // signal | order | position | risk | system | market
  metadata: jsonb("metadata"),
});

export type Log = typeof logsTable.$inferSelect;

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletTable = pgTable("wallet", {
  id: serial("id").primaryKey(),
  address: text("address"),
  connected: boolean("connected").notNull().default(false),
  network: text("network").default("mainnet"),
  encryptedMnemonic: text("encrypted_mnemonic"),
  publicKey: text("public_key"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Wallet = typeof walletTable.$inferSelect;
