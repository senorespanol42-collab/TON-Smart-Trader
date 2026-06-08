import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, walletTable } from "@workspace/db";
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
    res.json({
      connected: wallet.connected,
      address: wallet.address ?? null,
      balance: null,
      balanceUsd: null,
      network: wallet.network ?? "mainnet",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wallet/connect", async (req, res) => {
  try {
    const { address } = req.body as { address?: string; proof?: string };
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }
    const wallet = await getOrCreateWallet();
    await db
      .update(walletTable)
      .set({ connected: true, address, updatedAt: new Date() })
      .where(eq(walletTable.id, wallet.id));

    logger.info({ address }, "Wallet connected");
    res.json({ connected: true, address, balance: null, balanceUsd: null, network: wallet.network ?? "mainnet" });
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
      .set({ connected: false, address: null, updatedAt: new Date() })
      .where(eq(walletTable.id, wallet.id));
    logger.info("Wallet disconnected");
    res.json({ success: true, message: "Wallet disconnected" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
