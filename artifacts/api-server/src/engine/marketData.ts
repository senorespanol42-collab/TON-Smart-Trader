/**
 * Market Data Engine — Real Data
 *
 * Fetches live OHLCV and price data from Binance public API.
 * Falls back to CoinGecko for pairs not available on Binance.
 * No API keys required.
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

export const STORM_PAIRS: TradingPair[] = [
  { symbol: "TON/USDT", baseAsset: "TON", quoteAsset: "USDT", maxLeverage: 25, minSize: 1 },
  { symbol: "BTC/USDT", baseAsset: "BTC", quoteAsset: "USDT", maxLeverage: 50, minSize: 0.001 },
  { symbol: "ETH/USDT", baseAsset: "ETH", quoteAsset: "USDT", maxLeverage: 50, minSize: 0.01 },
  { symbol: "NOT/USDT", baseAsset: "NOT", quoteAsset: "USDT", maxLeverage: 10, minSize: 100 },
  { symbol: "DOGS/USDT", baseAsset: "DOGS", quoteAsset: "USDT", maxLeverage: 10, minSize: 1000 },
];

const BINANCE_SYMBOL: Record<string, string> = {
  "TON/USDT": "TONUSDT",
  "BTC/USDT": "BTCUSDT",
  "ETH/USDT": "ETHUSDT",
  "NOT/USDT": "NOTUSDT",
  "DOGS/USDT": "DOGSUSDT",
};

const COINGECKO_ID: Record<string, string> = {
  "TON/USDT": "the-open-network",
  "BTC/USDT": "bitcoin",
  "ETH/USDT": "ethereum",
  "NOT/USDT": "notcoin",
  "DOGS/USDT": "dogs",
};

type BinanceKline = [number, string, string, string, string, string, ...unknown[]];

type BinanceTicker = {
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

type CoinGeckoPrice = Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number }>;

// ── OHLCV ─────────────────────────────────────────────────────────────────────

async function fetchFromBinance(pair: string, interval: string, limit: number): Promise<Candle[]> {
  const symbol = BINANCE_SYMBOL[pair];
  if (!symbol) throw new Error(`No Binance symbol for ${pair}`);

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Binance OHLCV error: HTTP ${res.status}`);

  const raw = (await res.json()) as BinanceKline[];
  return raw.map((k) => ({
    timestamp: new Date(k[0]).toISOString(),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export async function generateOhlcv(pair: string, interval: string, limit: number): Promise<Candle[]> {
  try {
    return await fetchFromBinance(pair, interval, limit);
  } catch (err) {
    console.error(`[marketData] Binance OHLCV failed for ${pair}: ${err}. Trying CoinGecko...`);
    return fetchCoinGeckoOhlcv(pair, interval, limit);
  }
}

async function fetchCoinGeckoOhlcv(pair: string, interval: string, limit: number): Promise<Candle[]> {
  const id = COINGECKO_ID[pair];
  if (!id) throw new Error(`No CoinGecko ID for ${pair}`);

  const days = interval === "1d" ? 90 : interval === "4h" ? 30 : interval === "1h" ? 7 : 2;
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`CoinGecko OHLCV error: HTTP ${res.status}`);

  const raw = (await res.json()) as [number, number, number, number, number][];
  return raw.slice(-limit).map(([ts, o, h, l, c]) => ({
    timestamp: new Date(ts).toISOString(),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 0,
  }));
}

// ── Current Price ─────────────────────────────────────────────────────────────

async function fetchBinancePrice(pair: string): Promise<PriceData> {
  const symbol = BINANCE_SYMBOL[pair];
  if (!symbol) throw new Error(`No Binance symbol for ${pair}`);

  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`Binance price error: HTTP ${res.status}`);

  const d = (await res.json()) as BinanceTicker;
  const price = Number(d.lastPrice);
  const spread = price * 0.0001;

  return {
    pair,
    price,
    bid: Number(d.bidPrice) || price - spread,
    ask: Number(d.askPrice) || price + spread,
    change24h: Number(d.priceChangePercent),
    volume24h: Number(d.quoteVolume),
    timestamp: new Date().toISOString(),
  };
}

async function fetchCoinGeckoPrice(pair: string): Promise<PriceData> {
  const id = COINGECKO_ID[pair];
  if (!id) throw new Error(`No CoinGecko ID for ${pair}`);

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`CoinGecko price error: HTTP ${res.status}`);

  const data = (await res.json()) as CoinGeckoPrice;
  const info = data[id];
  if (!info) throw new Error(`No CoinGecko data for ${id}`);

  const price = info.usd;
  const spread = price * 0.0005;

  return {
    pair,
    price,
    bid: price - spread,
    ask: price + spread,
    change24h: info.usd_24h_change ?? 0,
    volume24h: info.usd_24h_vol ?? 0,
    timestamp: new Date().toISOString(),
  };
}

export async function getCurrentPrice(pair: string): Promise<PriceData> {
  try {
    return await fetchBinancePrice(pair);
  } catch (err) {
    console.error(`[marketData] Binance price failed for ${pair}: ${err}. Trying CoinGecko...`);
    return fetchCoinGeckoPrice(pair);
  }
}
