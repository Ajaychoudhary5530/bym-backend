import express from "express";
import {
  stockIn,
  stockOut,
  getStockHistory,
  exportStockHistory,
} from "../controllers/stockController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* =========================
   STOCK IN (ADMIN ONLY)
========================= */
router.post("/in", protect, adminOnly, stockIn);

/* =========================
   STOCK OUT
========================= */
router.post("/out", protect, stockOut);

/* =========================
   STOCK HISTORY
========================= */
router.get("/history", protect, getStockHistory);

/* =========================
   EXPORT HISTORY
========================= */
router.get("/export", protect, exportStockHistory);

export default router;
  