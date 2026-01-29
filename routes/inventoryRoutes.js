import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";
import {
  createInventory,
  updateOpeningQty,
} from "../controllers/inventoryController.js";

const router = express.Router();

router.post("/create", protect, adminOnly, createInventory);
router.put("/opening", protect, adminOnly, updateOpeningQty);

export default router;
