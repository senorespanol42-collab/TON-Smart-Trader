/**
 * Wallet Service — Real TON Wallet Management
 *
 * Imports a TON wallet from a 24-word mnemonic seed phrase.
 * Encrypts and persists the mnemonic in the database.
 * Provides keypair signing for real blockchain transactions.
 */

import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4, TonClient4, internal, SendMode } from "@ton/ton";
import { Address } from "@ton/core";
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "crypto";
import { db, walletTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

type KeyPair = Awaited<ReturnType<typeof mnemonicToPrivateKey>>;

// Derive a stable 32-byte encryption key from DATABASE_URL or env var
const rawKey = process.env.WALLET_ENCRYPTION_KEY ?? process.env.DATABASE_URL ?? "storm-bot-insecure-default";
const ENCRYPTION_KEY = scryptSync(rawKey, "storm-wallet-v1-salt", 32);

export const TON_CLIENT = new TonClient4({
  endpoint: "https://mainnet-v4.tonhubapi.com",
  timeout: 30_000,
});

// In-memory cache — avoids re-deriving keypair from mnemonic on every call
let _keypair: KeyPair | null = null;
let _address: string | null = null;

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const encrypted = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function importWalletFromMnemonic(mnemonic: string): Promise<{ address: string }> {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 24) {
    throw new Error(`Mnemonic must be exactly 24 words, got ${words.length}`);
  }

  const keypair = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });
  const address = wallet.address.toString({ bounceable: false, urlSafe: true });
  const encryptedMnemonic = encrypt(mnemonic.trim());
  const publicKey = keypair.publicKey.toString("hex");

  const rows = await db.select().from(walletTable).limit(1);
  if (rows.length > 0) {
    await db
      .update(walletTable)
      .set({ connected: true, address, encryptedMnemonic, publicKey, updatedAt: new Date() })
      .where(eq(walletTable.id, rows[0].id));
  } else {
    await db.insert(walletTable).values({ connected: true, address, encryptedMnemonic, publicKey });
  }

  _keypair = keypair;
  _address = address;

  logger.info({ address }, "Wallet imported from mnemonic — keypair loaded");
  return { address };
}

export async function loadKeypairFromDb(): Promise<KeyPair | null> {
  if (_keypair) return _keypair;

  const rows = await db.select().from(walletTable).limit(1);
  const row = rows[0];
  if (!row?.encryptedMnemonic) return null;

  try {
    const mnemonic = decrypt(row.encryptedMnemonic);
    const words = mnemonic.trim().split(/\s+/);
    _keypair = await mnemonicToPrivateKey(words);
    _address = row.address ?? null;
    logger.info({ address: _address }, "Keypair loaded from DB");
    return _keypair;
  } catch (err) {
    logger.error({ err }, "Failed to decrypt stored mnemonic");
    return null;
  }
}

export async function getActiveKeypair(): Promise<KeyPair | null> {
  return _keypair ?? loadKeypairFromDb();
}

export async function getWalletAddress(): Promise<string | null> {
  if (_address) return _address;
  const rows = await db.select().from(walletTable).limit(1);
  _address = rows[0]?.address ?? null;
  return _address;
}

export async function getRealBalance(address: string): Promise<{ ton: number; usdtEstimate: number }> {
  try {
    const url = `https://toncenter.com/api/v2/getAddressBalance?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`TonCenter HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; result: string };
    const ton = data.ok ? Number(data.result) / 1e9 : 0;
    return { ton, usdtEstimate: 0 };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch TON balance from TonCenter — trying fallback");
    try {
      // Fallback: v4 endpoint
      const addr = Address.parse(address);
      const state = await TON_CLIENT.getAccount(await TON_CLIENT.getLastBlock().then((b) => b.last.seqno), addr);
      const ton = Number(state.account.balance.coins) / 1e9;
      return { ton, usdtEstimate: 0 };
    } catch {
      return { ton: 0, usdtEstimate: 0 };
    }
  }
}

export interface TxParams {
  to: Address;
  body: import("@ton/core").Cell;
  value: bigint;
}

export async function sendTransaction(tx: TxParams): Promise<void> {
  const keypair = await getActiveKeypair();
  if (!keypair) throw new Error("No wallet loaded — import your mnemonic seed phrase first");

  const wallet = TON_CLIENT.open(WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey }));
  const seqno = await wallet.getSeqno();

  await wallet.sendTransfer({
    seqno,
    secretKey: keypair.secretKey,
    messages: [
      internal({
        to: tx.to,
        value: tx.value,
        body: tx.body,
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  logger.info({ seqno, to: tx.to.toString(), value: tx.value.toString() }, "TON transaction sent");
}
