/**
 * Market Data Engine
 *
 * Provides OHLCV data and price feeds. In production, this connects to
 * Storm Trade's on-chain oracles and liquidity pools. Currently provides
 * realistic simulated data with proper market micro-structure for
 * algorithm development and testing.
 */

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceData {
  pair: string;
  price: number;
  bid: number;
  ask: number;
  change24h: number;
  volume24h: number;
  timestamp: string;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  maxLeverage: number;
  minSize: number;
}

// Storm Trade supported perpetual pairs
export const STORM_PAIRS: TradingPair[] = [
  { symbol: "TON/USDT", baseAsset: "TON", quoteAsset: "USDT", maxLeverage: 25, minSize: 1 },
  { symbol: "BTC/USDT", baseAsset: "BTC", quoteAsset: "USDT", maxLeverage: 50, minSize: 0.001 },
  { symbol: "ETH/USDT", baseAsset: "ETH", quoteAsset: "USDT", maxLeverage: 50, minSize: 0.01 },
  { symbol: "NOT/USDT", baseAsset: "NOT", quoteAsset: "USDT", maxLeverage: 10, minSize: 100 },
  { symbol: "DOGS/USDT", baseAsset: "DOGS", quoteAsset: "USDT", maxLeverage: 10, minSize: 1000 },
];

const BASE_PRICES: Record<string, number> = {
  "TON/USDT": 5.42,
  "BTC/USDT": 103800,
  "ETH/USDT": 3920,
  "NOT/USDT": 0.0042,
  "DOGS/USDT": 0.00095,
};

// Simulate realistic price tick with micro-structure noise
function randomWalk(base: number, volatility: number): number {
  const change = (Math.random() - 0.499) * 2 * base * volatility;
  return base + change;
}

// Generate OHLCV candles with realistic market structure
export function generateOhlcv(pair: string, interval: string, limit: number): Candle[] {
  const base = BASE_PRICES[pair] ?? 1.0;
  const intervalMs = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
  }[interval] ?? 3_600_000;

  const volatility: Record<string, number> = {
    "1m": 0.0015,
    "5m": 0.003,
    "15m": 0.005,
    "1h": 0.008,
    "4h": 0.015,
    "1d": 0.025,
  };
  const vol = volatility[interval] ?? 0.008;

  const candles: Candle[] = [];
  let price = base;
  const now = Date.now();
  const startTime = now - (limit - 1) * intervalMs;

  // Add trend phases to make analysis more realistic
  let trend = 0; // -1 down, 0 sideways, +1 up
  let trendDuration = 0;

  for (let i = 0; i < limit; i++) {
    const ts = new Date(startTime + i * intervalMs);

    // Shift trend periodically
    trendDuration++;
    if (trendDuration > Math.floor(10 + Math.random() * 20)) {
      trend = Math.random() < 0.33 ? -1 : Math.random() < 0.5 ? 0 : 1;
      trendDuration = 0;
    }

    const trendBias = trend * vol * 0.3;
    const open = price;
    const close = Math.max(open * 0.5, open * (1 + trendBias + (Math.random() - 0.5) * vol * 2));
    const wick = Math.random() * vol * open;
    const high = Math.max(open, close) + Math.abs(wick);
    const low = Math.min(open, close) - Math.abs(wick * (Math.random() + 0.1));
    const volume = base * (50 + Math.random() * 200) * (1 + Math.abs(close - open) / open * 5);

    candles.push({
      timestamp: ts.toISOString(),
      open: Number(open.toFixed(8)),
      high: Number(high.toFixed(8)),
      low: Number(Math.max(low, open * 0.01).toFixed(8)),
      close: Number(close.toFixed(8)),
      volume: Number(volume.toFixed(2)),
    });

    price = close;
  }

  return candles;
}

export function getCurrentPrice(pair: string): PriceData {
  const base = BASE_PRICES[pair] ?? 1.0;
  const price = randomWalk(base, 0.001);
  const spread = price * 0.0005;
  const change24h = (Math.random() - 0.45) * 8; // -4% to +4% biased slightly positive

  return {
    pair,
    price: Number(price.toFixed(8)),
    bid: Number((price - spread).toFixed(8)),
    ask: Number((price + spread).toFixed(8)),
    change24h: Number(change24h.toFixed(2)),
    volume24h: Number((base * 500000 * (0.8 + Math.random() * 0.4)).toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}
