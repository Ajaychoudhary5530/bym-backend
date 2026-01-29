import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   CREATE INVENTORY
========================= */
export const createInventory = async (req, res) => {
  try {
    const { productId, openingQty } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const qty = Number(openingQty || 0);
    if (qty < 0) {
      return res
        .status(400)
        .json({ message: "Opening quantity cannot be negative" });
    }

    const exists = await Inventory.findOne({ productId });
    if (exists) {
      return res.status(400).json({
        message: "Inventory already exists for this product",
      });
    }

    const inventory = await Inventory.create({
      productId,
      openingQty: qty,
      quantity: qty,
      avgPurchasePrice: 0,
      totalValue: 0,
    });

    res.status(201).json({
      message: "Inventory created successfully",
      inventory,
    });
  } catch (err) {
    console.error("CREATE INVENTORY ERROR:", err);
    res.status(500).json({ message: "Failed to create inventory" });
  }
};

/* =========================
   RESET INVENTORY (DEV ONLY)
========================= */
export const resetInventoryForTest = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    // Reset inventory safely
    inventory.quantity = inventory.openingQty;
    inventory.avgPurchasePrice = 0;
    inventory.totalValue = 0;

    await inventory.save();

    // Remove stock logs
    await StockLog.deleteMany({ productId });

    res.json({ message: "Inventory reset successful" });
  } catch (err) {
    console.error("RESET INVENTORY ERROR:", err);
    res.status(500).json({ message: "Reset failed" });
  }
};
