import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   STOCK IN (NEW + RETURN)
========================= */
export const stockIn = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      stockType, // NEW | RETURN
      purchasePrice,
      invoiceNo,
      invoicePdfUrl,
      condition,
      remarks,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product" });
    }

    const inQty = Number(quantity);
    if (!inQty || inQty <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const finalStockType = stockType === "RETURN" ? "RETURN" : "NEW";

    if (finalStockType === "NEW") {
      if (!invoiceNo?.trim()) {
        return res.status(400).json({ message: "Invoice number required" });
      }
      if (isNaN(Number(purchasePrice)) || Number(purchasePrice) < 0) {
        return res
          .status(400)
          .json({ message: "Valid purchase price required" });
      }
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    // 🔑 SINGLE SOURCE OF TRUTH
    const oldQty = inventory.quantity;
    const oldAvg = inventory.avgPurchasePrice;

    let newAvg = oldAvg;

    // Weighted average ONLY for NEW stock
    if (finalStockType === "NEW") {
      const price = Number(purchasePrice);
      const totalValue =
        oldQty * oldAvg + inQty * price;

      newAvg =
        oldQty + inQty > 0
          ? Number((totalValue / (oldQty + inQty)).toFixed(2))
          : oldAvg;
    }

    inventory.quantity = oldQty + inQty;
    inventory.avgPurchasePrice = newAvg;
    await inventory.save();

    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "IN",
      stockType: finalStockType,
      quantity: inQty,
      purchasePrice: finalStockType === "NEW" ? Number(purchasePrice) : 0,
      invoiceNo: finalStockType === "NEW" ? invoiceNo.trim() : "",
      invoicePdfUrl: finalStockType === "NEW" ? invoicePdfUrl || "" : "",
      condition: finalStockType === "RETURN" ? condition || "GOOD" : "",
      remarks: remarks || "",
      date: new Date(),
    });

    res.json({ message: "Stock IN successful" });
  } catch (err) {
    console.error("STOCK IN ERROR:", err);
    res.status(500).json({ message: "Stock IN failed" });
  }
};

/* =========================
   STOCK OUT
========================= */
export const stockOut = async (req, res) => {
  try {
    const { productId, quantity, date, source } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product" });
    }

    const outQty = Number(quantity);
    if (!outQty || outQty <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    if (!["AMAZON", "OTHERS"].includes(source)) {
      return res.status(400).json({ message: "Invalid source" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (inventory.quantity < outQty) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    inventory.quantity -= outQty;
    await inventory.save();

    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "OUT",
      quantity: outQty,
      source,
      date: new Date(date),
    });

    res.json({ message: "Stock OUT successful" });
  } catch (err) {
    console.error("STOCK OUT ERROR:", err);
    res.status(500).json({ message: "Stock OUT failed" });
  }
};

/* =========================
   STOCK HISTORY
========================= */
export const getStockHistory = async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate("productId", "name sku")
      .populate("userId", "email")
      .sort({ date: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "History fetch failed" });
  }
};
