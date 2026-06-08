import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import walletRouter from "./wallet.js";
import riskRouter from "./risk.js";
import botRouter from "./bot.js";
import configRouter from "./config.js";
import positionsRouter from "./positions.js";
import ordersRouter from "./orders.js";
import tradesRouter from "./trades.js";
import marketRouter from "./market.js";
import analysisRouter from "./analysis.js";
import metricsRouter from "./metrics.js";
import logsRouter from "./logs.js";
import whitepaperRouter from "./whitepaper.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(riskRouter);
router.use(botRouter);
router.use(configRouter);
router.use(positionsRouter);
router.use(ordersRouter);
router.use(tradesRouter);
router.use(marketRouter);
router.use(analysisRouter);
router.use(metricsRouter);
router.use(logsRouter);
router.use(whitepaperRouter);

export default router;
