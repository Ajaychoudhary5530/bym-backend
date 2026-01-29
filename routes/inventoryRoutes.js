import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";
import {
  createInventory,
  resetInventoryForTest,
} from "../controllers/inventoryController.js";
import { updateOpeningInventory } from "../controllers/inventoryController.js";


const router = express.Router();

router.post("/create", protect, adminOnly, createInventory);
router.post("/reset", protect, adminOnly, resetInventoryForTest);
router.put("/opening", protect, adminOnly, updateOpeningInventory);


export default router;
