import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

const router = express.Router();

// ⚠️ DELETE ALL DATA (ONLY ADMIN)
router.delete("/all", protect, adminOnly, async (req, res) => {
  try {
    await StockLog.deleteMany({});
    await Inventory.deleteMany({});
    await Product.deleteMany({});

    res.json({ message: "All inventory data cleared successfully" });
  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Reset failed" });
  }
});

export default router;
