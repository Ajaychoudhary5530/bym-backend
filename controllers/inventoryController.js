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
    const price = Number(avgPurchasePrice || 0);

    if (qty < 0 || price < 0) {
      return res.status(400).json({
        message: "Opening quantity or price cannot be negative",
      });
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
      avgPurchasePrice: price,
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
   UPDATE OPENING INVENTORY
   (SUPER ADMIN CORRECTION)
========================= */
export const updateOpeningInventory = async (req, res) => {
  try {
    const { productId, openingQty, openingPrice, reason } = req.body;

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

    const oldQty = inventory.openingQty;
    const oldPrice = inventory.avgPurchasePrice;

    inventory.openingQty = qty;
    inventory.avgPurchasePrice = price;

    await inventory.save();

    /* Audit log */
    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "ADJUST",
      adjustmentType: "INCREASE",
      adjustmentReason:
        reason ||
        `Opening correction: Qty ${oldQty}→${qty}, Price ${oldPrice}→${price}`,
      quantity: Math.abs(qty - oldQty) || 1,
      date: new Date(),
    });

    res.json({
      message: "Opening inventory corrected",
      inventory,
    });
  } catch (err) {
    console.error("UPDATE OPENING ERROR:", err);
    res.status(500).json({ message: "Failed to update opening inventory" });
  }
};

/* =========================
   RESET INVENTORY (DEV)
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

    await inventory.save();

    await StockLog.deleteMany({ productId });

    res.json({ message: "Inventory reset successful" });
  } catch (err) {
    console.error("RESET INVENTORY ERROR:", err);
    res.status(500).json({ message: "Reset failed" });
  }
};
