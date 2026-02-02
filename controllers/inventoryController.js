import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";
import Product from "../models/Product.js";

/* =========================
   GET ALL INVENTORY (DASHBOARD)
========================= */
export const getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find()
      .populate("productId", "name sku category variant unit minStock")
      .sort({ createdAt: -1 });

    res.json(inventory);
  } catch (err) {
    console.error("GET INVENTORY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};

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
    inventory.quantity = qty; // keep quantity in sync

    await inventory.save();

    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "ADJUST",
      adjustmentType: qty >= oldQty ? "INCREASE" : "DECREASE",
      quantity: Math.abs(qty - oldQty) || 1,
      date: new Date(),
      adjustmentReason:
        reason ||
        `Opening correction: Qty ${oldQty} → ${qty}, Price ${oldPrice} → ${price}`,
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
   ADJUST MINIMUM STOCK (ADJ)
========================= */
export const adjustMinStock = async (req, res) => {
  try {
    const { productId, minStock, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const newMinStock = Number(minStock);

    if (isNaN(newMinStock) || newMinStock < 0) {
      return res.status(400).json({
        message: "Minimum stock must be a non-negative number",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const oldMinStock = product.minStock;

    if (oldMinStock === newMinStock) {
      return res.json({
        message: "Minimum stock unchanged",
        minStock: oldMinStock,
      });
    }

    product.minStock = newMinStock;
    await product.save();

    const diff = newMinStock - oldMinStock;

    await StockLog.create({
      productId: product._id,
      userId: req.user._id,
      type: "ADJUST",
      adjustmentType: diff > 0 ? "INCREASE" : "DECREASE",
      quantity: Math.abs(diff) || 1, // schema requires min 1
      date: new Date(),
      adjustmentReason: reason || "Minimum stock adjusted",
      remarks: `MinStock changed: ${oldMinStock} → ${newMinStock}`,
    });

    res.json({
      message: "Minimum stock updated successfully",
      productId: product._id,
      oldMinStock,
      newMinStock,
    });
  } catch (err) {
    console.error("ADJUST MIN STOCK ERROR:", err);
    res.status(500).json({ message: "Failed to update minimum stock" });
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

/* =========================
   UPDATE MINIMUM STOCK (ADJUST)
========================= */
export const updateMinStock = async (req, res) => {
  try {
    const { productId, minStock, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    if (minStock === undefined || Number(minStock) < 0) {
      return res.status(400).json({ message: "Invalid minimum stock" });
    }

    const inventory = await Inventory.findOne({ productId }).populate(
      "productId"
    );

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const oldMinStock = inventory.productId.minStock || 0;

    inventory.productId.minStock = Number(minStock);
    await inventory.productId.save();

    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "ADJUST",
      adjustmentType:
        minStock >= oldMinStock ? "INCREASE" : "DECREASE",
      adjustmentReason:
        reason ||
        `Min stock changed ${oldMinStock} → ${minStock}`,
      quantity: Math.abs(minStock - oldMinStock) || 1,
      date: new Date(),
    });

    res.json({
      message: "Minimum stock updated successfully",
      productId,
      oldMinStock,
      newMinStock: Number(minStock),
    });
  } catch (err) {
    console.error("MIN STOCK UPDATE ERROR:", err);
    res.status(500).json({ message: "Min stock update failed" });
  }
};

