/**
 * Storm Trade Executor — Real On-Chain Trade Execution
 *
 * Uses the official @storm-trade/sdk to open and close real perpetual
 * positions on Storm Trade DEX on the TON blockchain.
 *
 * Vault: USDT (mainnet)
 * Pairs: TON, BTC, ETH, NOT (base asset extracted from pair symbol)
 */

import { StormSDK, Direction, toStablecoin, numToNano } from "@storm-trade/sdk";
import { TON_CLIENT, getWalletAddress, sendTransaction, type TxParams } from "./walletService.js";
import { logger } from "../lib/logger.js";
import { Address } from "@ton/core";

// Mainnet USDT vault — the primary Storm Trade perpetuals market
const sdk = StormSDK.asMainnetUSDT(TON_CLIENT as any);

export type TradeDirection = "long" | "short";

export interface OpenPositionOpts {
  pair: string;         // e.g. "TON/USDT"
  direction: TradeDirection;
  amountUsdt: number;   // margin in USDT (e.g. 50 = $50)
  leverage: number;     // integer leverage (e.g. 3 for 3x)
  stopLoss: number;     // stop-loss price trigger
  takeProfit: number;   // take-profit price trigger
}

export interface ClosePositionOpts {
  pair: string;
  direction: TradeDirection;
  size: number;         // position size in base asset units (9 decimals)
}

function baseAsset(pair: string): string {
  return pair.split("/")[0]; // "TON/USDT" → "TON"
}

function toDirection(dir: TradeDirection): Direction {
  return dir === "long" ? Direction.long : Direction.short;
}

/**
 * Opens a real leveraged perpetual position on Storm Trade.
 * Returns a local position ID (the actual tx hash is not immediately
 * available on TON — use the TON explorer to verify).
 */
export async function openPosition(opts: OpenPositionOpts): Promise<string> {
  const walletAddr = await getWalletAddress();
  if (!walletAddr) throw new Error("No wallet — import mnemonic first");

  const traderAddress = Address.parse(walletAddr);
  const asset = baseAsset(opts.pair);
  const direction = toDirection(opts.direction);

  // Convert to SDK's fixed-point representations
  const amount = toStablecoin(opts.amountUsdt);      // USDT: 6 decimals
  const leverage = numToNano(opts.leverage);          // leverage: 9 decimals
  const stopTriggerPrice = numToNano(opts.stopLoss);  // price: 9 decimals
  const takeTriggerPrice = numToNano(opts.takeProfit);

  logger.info(
    { pair: opts.pair, direction: opts.direction, amountUsdt: opts.amountUsdt, leverage: opts.leverage, sl: opts.stopLoss, tp: opts.takeProfit },
    "Preparing Storm Trade increase-position tx",
  );

  const txParams = await sdk.increasePosition({
    baseAsset: asset,
    traderAddress,
    direction,
    amount,
    leverage,
    stopTriggerPrice,
    takeTriggerPrice,
  });

  await sendTransaction(txParams as TxParams);

  const positionId = `${opts.pair.replace("/", "-")}-${opts.direction}-${Date.now()}`;
  logger.info({ positionId, to: txParams.to.toString() }, "Storm Trade open-position tx dispatched");
  return positionId;
}

/**
 * Closes an existing on-chain position on Storm Trade.
 */
export async function closePosition(opts: ClosePositionOpts): Promise<void> {
  const walletAddr = await getWalletAddress();
  if (!walletAddr) throw new Error("No wallet — import mnemonic first");

  const traderAddress = Address.parse(walletAddr);
  const asset = baseAsset(opts.pair);
  const direction = toDirection(opts.direction);
  const size = numToNano(opts.size);

  logger.info({ pair: opts.pair, direction: opts.direction, size: opts.size }, "Preparing Storm Trade close-position tx");

  const txParams = await sdk.closePosition({
    baseAsset: asset,
    traderAddress,
    direction,
    size,
  });

  await sendTransaction(txParams as TxParams);
  logger.info({ to: txParams.to.toString() }, "Storm Trade close-position tx dispatched");
}

/**
 * Fetches the live on-chain position data from Storm Trade.
 * Returns null if no position exists.
 */
export async function getOnChainPosition(pair: string): Promise<unknown> {
  const walletAddr = await getWalletAddress();
  if (!walletAddr) return null;

  try {
    const traderAddress = Address.parse(walletAddr);
    const asset = baseAsset(pair);
    return await sdk.getPositionAccountData(traderAddress, asset);
  } catch (err) {
    logger.warn({ err, pair }, "getOnChainPosition failed");
    return null;
  }
}

/**
 * Returns the live index price for a pair from Storm Trade's oracle.
 */
export async function getOraclePrice(pair: string): Promise<number | null> {
  try {
    const asset = baseAsset(pair);
    const priceBigInt = await sdk.getIndexPrice(asset);
    return Number(priceBigInt) / 1e9;
  } catch (err) {
    logger.warn({ err, pair }, "getOraclePrice failed");
    return null;
  }
}
