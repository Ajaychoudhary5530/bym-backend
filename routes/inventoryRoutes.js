import express from "express";
import {
  getAllInventory,
  createInventory,
  updateOpeningInventory,
  resetInventoryForTest,
} from "../controllers/inventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* =========================
   GET INVENTORY (DASHBOARD)
========================= */
router.get("/", protect, getAllInventory);

/* =========================
   CREATE INVENTORY
========================= */
router.post("/", protect, adminOnly, createInventory);

/* =========================
   UPDATE OPENING STOCK
========================= */
router.put("/opening", protect, adminOnly, updateOpeningInventory);

/* =========================
   RESET INVENTORY (DEV)
========================= */
router.post("/reset", protect, adminOnly, resetInventoryForTest);

export default router;
