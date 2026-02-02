import express from "express";
import {
  getAllInventory,
  createInventory,
  updateOpeningInventory,
  resetInventoryForTest,
  updateMinStock,
} from "../controllers/inventoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { superAdminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* DASHBOARD */
router.get("/", protect, getAllInventory);

/* INVENTORY */
router.post("/", protect, superAdminOnly, createInventory);
router.put("/opening", protect, superAdminOnly, updateOpeningInventory);
router.put(
  "/adjust-min-stock",
  protect,
  superAdminOnly,
  updateMinStock
);

/* DEV */
router.post("/reset", protect, superAdminOnly, resetInventoryForTest);

export default router;
