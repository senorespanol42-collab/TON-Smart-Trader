import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, walletTable } from "@workspace/db";
import { importWalletFromMnemonic, getWalletAddress, getRealBalance } from "../services/walletService.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function getOrCreateWallet() {
  const rows = await db.select().from(walletTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(walletTable).values({ connected: false }).returning();
  return created;
}

router.get("/wallet", async (req, res) => {
  try {
    const wallet = await getOrCreateWallet();
    let ton = 0;
    let usdtEstimate = 0;

    if (wallet.connected && wallet.address) {
      try {
        const bal = await getRealBalance(wallet.address);
        ton = bal.ton;
        usdtEstimate = bal.usdtEstimate;
      } catch {
        // balance fetch is best-effort
      }
    }

    res.json({
      connected: wallet.connected,
      address: wallet.address ?? null,
      balance: ton > 0 ? ton : null,
      balanceUsd: usdtEstimate > 0 ? usdtEstimate : null,
      network: wallet.network ?? "mainnet",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Import wallet from 24-word mnemonic seed phrase
router.post("/wallet/import", async (req, res) => {
  try {
    const { mnemonic } = req.body as { mnemonic?: string };
    if (!mnemonic || typeof mnemonic !== "string") {
      res.status(400).json({ error: "mnemonic is required (24-word seed phrase)" });
      return;
    }

    const { address } = await importWalletFromMnemonic(mnemonic);
    let ton = 0;
    try {
      const bal = await getRealBalance(address);
      ton = bal.ton;
    } catch {}

    res.json({
      connected: true,
      address,
      balance: ton,
      balanceUsd: null,
      network: "mainnet",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import wallet";
    req.log.error({ err }, message);
    res.status(400).json({ error: message });
  }
});

// Legacy connect endpoint (address-only, no signing)
router.post("/wallet/connect", async (req, res) => {
  try {
    const { address } = req.body as { address?: string };
    if (!address) {
      res.status(400).json({ error: "address is required. Use /wallet/import to import via mnemonic." });
      return;
    }
    const wallet = await getOrCreateWallet();
    await db
      .update(walletTable)
      .set({ connected: true, address, updatedAt: new Date() })
      .where(eq(walletTable.id, wallet.id));

    logger.info({ address }, "Wallet address stored (read-only, no keypair)");
    res.json({ connected: true, address, balance: null, balanceUsd: null, network: "mainnet" });
  } catch (err) {
    req.log.error({ err }, "Failed to connect wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wallet/disconnect", async (_req, res) => {
  try {
    const wallet = await getOrCreateWallet();
    await db
      .update(walletTable)
      .set({ connected: false, address: null, encryptedMnemonic: null, publicKey: null, updatedAt: new Date() })
      .where(eq(walletTable.id, wallet.id));
    logger.info("Wallet disconnected and mnemonic cleared");
    res.json({ success: true, message: "Wallet disconnected" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
