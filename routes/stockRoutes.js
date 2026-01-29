import express from "express";
import {
  stockIn,
  stockOut,
  getStockHistory,
  exportStockHistory,
  adjustStock,
} from "../controllers/stockController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly, superAdminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* =========================
   STOCK IN (ADMIN + SUPERADMIN)
========================= */
router.post("/in", protect, adminOnly, stockIn);

/* =========================
   STOCK ADJUST (SUPERADMIN)
========================= */
router.post("/adjust", protect, superAdminOnly, adjustStock);

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
