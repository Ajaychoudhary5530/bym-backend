import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   CREATE INVENTORY
========================= */
export const createInventory = async (req, res) => {
  try {
    const { productId, openingQty, avgPurchasePrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const qty = Number(openingQty || 0);
    if (qty < 0) {
      return res
        .status(400)
        .json({ message: "Opening quantity cannot be negative" });
    }

    const price = Number(avgPurchasePrice || 0);
    if (price < 0) {
      return res
        .status(400)
        .json({ message: "Average price cannot be negative" });
    }

    const exists = await Inventory.findOne({ productId });
    if (exists) {
      return res.status(400).json({
        message: "Inventory already exists for this product",
      });
    }

    const totalValue = qty * price;

    const inventory = await Inventory.create({
      productId,
      openingQty: qty,
      quantity: qty,
      avgPurchasePrice: price,
      totalValue,
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
   UPDATE OPENING INVENTORY (SUPER ADMIN)
========================= */
export const updateOpeningInventory = async (req, res) => {
  try {
    const { productId, openingQty, openingPrice } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const qty = Number(openingQty);
    const price = Number(openingPrice);

    if (qty < 0 || price < 0) {
      return res.status(400).json({
        message: "Opening quantity or price cannot be negative",
      });
    }

    /*
      Fix logic:
      - Opening stock price becomes base price
      - Current quantity stays same
      - Avg price recalculated
    */

    const currentQty = inventory.quantity;

    const totalValue = currentQty * price;

    inventory.openingQty = qty;
    inventory.avgPurchasePrice = price;
    inventory.totalValue = totalValue;

    await inventory.save();

    res.json({
      message: "Opening inventory updated",
      inventory,
    });
  } catch (err) {
    console.error("UPDATE OPENING ERROR:", err);
    res.status(500).json({ message: "Failed to update opening inventory" });
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

    inventory.quantity = inventory.openingQty;
    inventory.totalValue =
      inventory.openingQty * inventory.avgPurchasePrice;

    await inventory.save();

    await StockLog.deleteMany({ productId });

    res.json({ message: "Inventory reset successful" });
  } catch (err) {
    console.error("RESET INVENTORY ERROR:", err);
    res.status(500).json({ message: "Reset failed" });
  }
};
