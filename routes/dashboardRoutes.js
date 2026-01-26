import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const products = await Product.find();
    const data = [];

    for (const p of products) {
      const inventory = await Inventory.findOne({ productId: p._id });

      const logs = await StockLog.find({ productId: p._id });

      // ✅ Opening = only opening bulk logs
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

      data.push({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        variant: p.variant || "-",
        unit: p.unit,
        category: p.category || "-",

        openingQty,
        qtyIn,
        amazonOut,
        othersOut,
        currentQty,

        avgPurchasePrice: inventory?.avgPurchasePrice || 0,
        stockValue: currentQty * (inventory?.avgPurchasePrice || 0),

        minStock: p.minStock || 0,
      });
    }

    res.json(data);
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Dashboard load failed" });
  }
});

export default router;
