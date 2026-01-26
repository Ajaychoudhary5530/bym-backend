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
      invoiceNo,
      purchasePrice,
      invoicePdfUrl,

      // NEW for Return Product
      stockType, // "NEW" | "RETURN"
      condition, // "GOOD" | "DAMAGED"
      remarks, // string
    } = req.body;

    // ✅ Basic validations
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const inQty = Number(quantity);
    if (!inQty || inQty <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    // Decide stockType safely
    const finalStockType = stockType === "RETURN" ? "RETURN" : "NEW";

    // ✅ Validation based on stockType
    if (finalStockType === "NEW") {
      if (!invoiceNo || !String(invoiceNo).trim()) {
        return res.status(400).json({ message: "Invoice number is required" });
      }

      const price = Number(purchasePrice);
      if (purchasePrice === "" || isNaN(price) || price < 0) {
        return res
          .status(400)
          .json({ message: "Valid purchase price is required" });
      }
    }

    // Find inventory
    let inventory = await Inventory.findOne({ productId });

    if (!inventory) {
      inventory = await Inventory.create({
        productId,
        quantity: 0,
        avgPurchasePrice: 0,
        totalValue: 0,
      });
    }

    const oldQty = Number(inventory.quantity);
    const oldTotalValue = Number(inventory.totalValue);
    const oldAvgPrice = Number(inventory.avgPurchasePrice);

    // Always increase quantity
    const newQty = oldQty + inQty;

    // ✅ NEW STOCK -> Weighted average changes
    if (finalStockType === "NEW") {
      const price = Number(purchasePrice);
      const inValue = inQty * price;

      const newTotalValue = oldTotalValue + inValue;
      const newAvgPrice = newQty > 0 ? newTotalValue / newQty : 0;

      inventory.quantity = newQty;
      inventory.totalValue = newTotalValue;
      inventory.avgPurchasePrice = Number(newAvgPrice.toFixed(2));
    }

    // ✅ RETURN STOCK -> Avg price should NOT change
    if (finalStockType === "RETURN") {
      inventory.quantity = newQty;

      // Keep avgPurchasePrice same
      inventory.avgPurchasePrice = Number(oldAvgPrice.toFixed(2));

      // Recalculate totalValue using existing avg price
      inventory.totalValue = newQty * oldAvgPrice;
    }

    await inventory.save();

    // ✅ Create Stock Log
    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "IN",
      stockType: finalStockType,

      condition: finalStockType === "RETURN" ? condition || "GOOD" : "",
      remarks: finalStockType === "RETURN" ? (remarks || "").trim() : "",

      quantity: inQty,
      date: new Date(),

      // invoice details
      invoiceNo: finalStockType === "NEW" ? String(invoiceNo).trim() : "",
      purchasePrice: finalStockType === "NEW" ? Number(purchasePrice) : 0,
      invoicePdfUrl: finalStockType === "NEW" ? invoicePdfUrl || "" : "",
    });

    res.json({
      message: "Stock IN successful",
      avgPurchasePrice: inventory.avgPurchasePrice,
    });
  } catch (err) {
    console.error("STOCK IN ERROR:", err);
    res.status(500).json({ message: "Stock IN failed" });
  }
};

/* =========================
   STOCK OUT (VALIDATION)
========================= */
export const stockOut = async (req, res) => {
  try {
    const { productId, quantity, date, source } = req.body;

    // ✅ BASIC VALIDATION
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product" });
    }

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    // ✅ Block future dates (compare with real today)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDate > today) {
      return res.status(400).json({
        message: "Future date not allowed. Please select today or past date.",
      });
    }

    // ✅ ONLY TWO SOURCES ALLOWED
    if (!["AMAZON", "OTHERS"].includes(source)) {
      return res.status(400).json({
        message: "Stock OUT source must be AMAZON or OTHERS",
      });
    }

    const inventory = await Inventory.findOne({ productId });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (inventory.quantity < Number(quantity)) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    // ✅ UPDATE INVENTORY
    inventory.quantity -= Number(quantity);
    inventory.totalValue = inventory.quantity * inventory.avgPurchasePrice;

    await inventory.save();

    // ✅ LOG STOCK OUT
    await StockLog.create({
      productId,
      userId: req.user._id,
      type: "OUT",
      quantity: Number(quantity),
      date: selectedDate,
      source,
      remarks: "",
      stockType: "NEW", // default
      condition: "",
      invoiceNo: "",
      purchasePrice: 0,
      invoicePdfUrl: "",
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
    const { from, to, productId } = req.query;
    const filter = {};

    if (from && to) {
      filter.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    if (productId) {
      filter.productId = productId;
    }

    const logs = await StockLog.find(filter)
      .populate("productId", "name sku")
      .populate("userId", "email")
      .sort({ date: -1 })
      .select(
        "productId type stockType condition quantity date userId invoiceNo purchasePrice invoicePdfUrl source remarks"
      );

    res.json(logs);
  } catch (err) {
    console.error("HISTORY ERROR:", err);
    res.status(500).json({ message: "Failed to load history" });
  }
};

/* =========================
   EXPORT STOCK HISTORY
========================= */
export const exportStockHistory = async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate("productId", "name sku")
      .populate("userId", "email")
      .sort({ date: -1 });

    const safe = (val) => {
      const s = val === null || val === undefined ? "" : String(val);
      // remove line breaks + escape quotes
      return `"${s.replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`;
    };

    let csv =
      "Product,SKU,Type,StockType,Condition,Quantity,Source,PurchasePrice,InvoiceNo,InvoicePDF,Remarks,Date,User\n";

    logs.forEach((l) => {
      const row = [
        safe(l.productId?.name),
        safe(l.productId?.sku),
        safe(l.type),
        safe(l.stockType),
        safe(l.condition),
        safe(l.quantity),
        safe(l.source),
        safe(l.purchasePrice),
        safe(l.invoiceNo),
        safe(l.invoicePdfUrl),
        safe(l.remarks),
        safe(l.date ? l.date.toISOString().split("T")[0] : ""),
        safe(l.userId?.email),
      ].join(",");

      csv += row + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=stock-history.csv"
    );

    res.send(csv);
  } catch (err) {
    console.error("EXPORT ERROR:", err);
    res.status(500).json({ message: "Export failed" });
  }
};
