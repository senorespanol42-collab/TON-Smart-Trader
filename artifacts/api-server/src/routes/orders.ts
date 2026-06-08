import { Router } from "express";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

function serializeOrder(row: typeof ordersTable.$inferSelect) {
  return {
    id: row.id,
    pair: row.pair,
    side: row.side as "long" | "short",
    type: row.type as "limit" | "market" | "stop",
    price: Number(row.price),
    size: Number(row.size),
    sizeUsd: Number(row.sizeUsd),
    createdAt: row.createdAt.toISOString(),
    status: row.status as "pending" | "filled" | "cancelled" | "expired",
  };
}

router.get("/orders", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending"));
    res.json(rows.map(serializeOrder));
  } catch (err) {
    req.log.error({ err }, "Failed to get orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    await db
      .update(ordersTable)
      .set({ status: "cancelled" })
      .where(eq(ordersTable.id, req.params.id));
    logger.info({ orderId: req.params.id }, "Order cancelled");
    res.json({ success: true, message: "Order cancelled" });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel order");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
