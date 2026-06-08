import { Router } from "express";
import { WHITEPAPER } from "../data/whitepaper.js";

const router = Router();

router.get("/whitepaper", (_req, res) => {
  res.json(WHITEPAPER);
});

export default router;
