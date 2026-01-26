import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

const router = express.Router();

/* =========================
   DASHBOARD DATA
========================= */
router.get("/", protect, async (req, res) => {
  try {
    const products = await Product.find();
    const data = [];

    for (const p of products) {
      const inventory = await Inventory.findOne({ productId: p._id });
      const logs = await StockLog.find({ productId: p._id });

      const openingQty = logs
        .filter(
          (l) =>
            l.type === "IN" &&
            (l.remarks || "").toLowerCase().includes("opening stock")
        )
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const qtyIn = logs
        .filter((l) => l.type === "IN")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const amazonOut = logs
        .filter((l) => l.type === "OUT" && l.source === "AMAZON")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const othersOut = logs
        .filter((l) => l.type === "OUT" && l.source === "OTHERS")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const currentQty = inventory?.quantity || 0;
      const avgPurchasePrice = inventory?.avgPurchasePrice || 0;

      data.push({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category || "-",
        variant: p.variant || "-",
        unit: p.unit,
        openingQty,
        qtyIn,
        amazonOut,
        othersOut,
        currentQty,
        minStock: p.minStock || 0,
        avgPurchasePrice,
        stockValue: currentQty * avgPurchasePrice,
      });
    }

    res.json(data);
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Dashboard load failed" });
  }
});

/* =========================
   EXPORT DASHBOARD CSV
========================= */
router.get("/export", protect, async (req, res) => {
  try {
    const products = await Product.find();
    let csv =
      "Item,SKU,Category,Variant,UOM,Opening Qty,Qty IN,Amazon OUT,Others OUT,Current Qty,Min Stock,Avg Price,Stock Value\n";

    for (const p of products) {
      const inventory = await Inventory.findOne({ productId: p._id });
      const logs = await StockLog.find({ productId: p._id });

      const openingQty = logs
        .filter(
          (l) =>
            l.type === "IN" &&
            (l.remarks || "").toLowerCase().includes("opening stock")
        )
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const qtyIn = logs
        .filter((l) => l.type === "IN")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const amazonOut = logs
        .filter((l) => l.type === "OUT" && l.source === "AMAZON")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const othersOut = logs
        .filter((l) => l.type === "OUT" && l.source === "OTHERS")
        .reduce((s, l) => s + Number(l.quantity || 0), 0);

      const currentQty = inventory?.quantity || 0;
      const avgPurchasePrice = inventory?.avgPurchasePrice || 0;
      const stockValue = currentQty * avgPurchasePrice;

      const safe = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

      csv +=
        `${safe(p.name)},` +
        `${safe(p.sku)},` +
        `${safe(p.category || "-")},` +
        `${safe(p.variant || "-")},` +
        `${safe(p.unit)},` +
        `${openingQty},` +
        `${qtyIn},` +
        `${amazonOut},` +
        `${othersOut},` +
        `${currentQty},` +
        `${p.minStock || 0},` +
        `${avgPurchasePrice},` +
        `${stockValue}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=dashboard-export.csv"
    );

    res.send(csv);
  } catch (err) {
    console.error("DASHBOARD EXPORT ERROR:", err);
    res.status(500).json({ message: "Dashboard export failed" });
  }
});

export default router;
