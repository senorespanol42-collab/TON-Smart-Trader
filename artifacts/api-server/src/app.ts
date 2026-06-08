import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, botStateTable } from "@workspace/db";
import { startBotLoop } from "./services/botLoop.js";
import { loadKeypairFromDb } from "./services/walletService.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// On startup: pre-load wallet keypair and resume bot loop if it was running
async function onStartup() {
  try {
    await loadKeypairFromDb();
    const rows = await db.select().from(botStateTable).limit(1);
    if (rows[0]?.state === "running") {
      logger.info("Bot was running before restart — resuming execution loop");
      startBotLoop();
    }
  } catch (err) {
    logger.error({ err }, "Startup init error");
  }
}
void onStartup();

export default app;
