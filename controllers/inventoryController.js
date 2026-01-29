import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";

/* =========================
   CREATE INVENTORY (ONE TIME)
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
   UPDATE OPENING QTY (ADMIN SAFE)
========================= */
export const updateOpeningQty = async (req, res) => {
  try {
    const { productId, openingQty } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const qty = Number(openingQty);
    if (isNaN(qty) || qty < 0) {
      return res
        .status(400)
        .json({ message: "Opening quantity must be >= 0" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    // ❗ Only allow if no stock movement yet
    if (inventory.quantity !== inventory.openingQty) {
      return res.status(400).json({
        message: "Cannot update opening quantity after stock movement",
      });
    }

    // 🔥 FORCE SYNC (this is the fix)
    inventory.openingQty = qty;
    inventory.quantity = qty;
    inventory.avgPurchasePrice = 0;
    inventory.totalValue = 0;

    await inventory.save();

    res.json({
      message: "Opening quantity updated successfully",
      inventory,
    });
  } catch (err) {
    console.error("UPDATE OPENING QTY ERROR:", err);
    res.status(500).json({ message: "Failed to update opening quantity" });
  }
};
