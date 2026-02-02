import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

import {
  getProductsWithStock,
} from "../controllers/productController.js";

const router = express.Router();

/* =========================
   DASHBOARD
========================= */
router.get("/with-stock", protect, getProductsWithStock);

export default router;
