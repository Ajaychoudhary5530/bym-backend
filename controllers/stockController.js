import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   STOCK IN
========================= */
export const stockIn = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      stockType,
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
        return res.status(400).json({
          message: "Valid purchase price required",
        });
      }
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const oldQty = inventory.quantity;
    const oldAvg = inventory.avgPurchasePrice;

    let newAvg = oldAvg;

    if (finalStockType === "NEW") {
      const price = Number(purchasePrice);
      const totalValue = oldQty * oldAvg + inQty * price;

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
    const { from, to, productId } = req.query;
    const filter = {};

    if (from && to) {
      filter.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    if (productId) filter.productId = productId;

    const logs = await StockLog.find(filter)
      .populate("productId", "name sku")
      .populate("userId", "email")
      .sort({ date: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "History fetch failed" });
  }
};

/* =========================
   EXPORT HISTORY CSV
========================= */
export const exportStockHistory = async (req, res) => {
  try {
    const { from, to, productId } = req.query;
    const filter = {};

    if (from && to) {
      filter.date = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    if (productId) filter.productId = productId;

    const logs = await StockLog.find(filter)
      .populate("productId", "name sku")
      .populate("userId", "email")
      .sort({ date: -1 });

    const safe = (val) => {
      const s = val === null || val === undefined ? "" : String(val);
      return `"${s.replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`;
    };

    let csv =
      "Product,SKU,Type,StockType,Condition,Quantity,Source,PurchasePrice,InvoiceNo,Remarks,Date,User\n";

    logs.forEach((l) => {
      csv += [
        safe(l.productId?.name),
        safe(l.productId?.sku),
        safe(l.type),
        safe(l.stockType),
        safe(l.condition),
        safe(l.quantity),
        safe(l.source),
        safe(l.purchasePrice),
        safe(l.invoiceNo),
        safe(l.remarks),
        safe(l.date?.toISOString().split("T")[0]),
        safe(l.userId?.email),
      ].join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=stock-history.csv"
    );

    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Export failed" });
  }
};
