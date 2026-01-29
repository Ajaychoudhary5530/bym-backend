import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   PRODUCTS WITH STOCK (DASHBOARD)
========================= */
export const getProductsWithStock = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search || "";

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const productIds = products.map((p) => p._id);

    // Fetch inventories
    const inventories = await Inventory.find({
      productId: { $in: productIds },
    });

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[String(inv.productId)] = inv;
    });

    // Fetch stock logs
    const logs = await StockLog.find({
      productId: { $in: productIds },
    });

    // Aggregate logs
    const logMap = {};
    logs.forEach((log) => {
      const pid = String(log.productId);
      if (!logMap[pid]) {
        logMap[pid] = {
          qtyIn: 0,
          amazonOut: 0,
          othersOut: 0,
        };
      }

      if (log.type === "IN") {
        logMap[pid].qtyIn += log.quantity;
      }

      if (log.type === "OUT") {
        if (log.source === "AMAZON") {
          logMap[pid].amazonOut += log.quantity;
        } else {
          logMap[pid].othersOut += log.quantity;
        }
      }
    });

    // Build dashboard response
    const data = products.map((p) => {
      const inv = inventoryMap[String(p._id)];
      const logsAgg = logMap[String(p._id)] || {
        qtyIn: 0,
        amazonOut: 0,
        othersOut: 0,
      };

      const openingQty = inv?.openingQty || 0;
      const currentQty = inv?.quantity || 0;
      const avgPurchasePrice = inv?.avgPurchasePrice || 0;

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        variant: p.variant,

        openingQty,
        currentQty,

        qtyIn: logsAgg.qtyIn,
        amazonOut: logsAgg.amazonOut,
        othersOut: logsAgg.othersOut,

        minStock: p.minStock || 0,
        avgPurchasePrice,
        stockValue: Number((currentQty * avgPurchasePrice).toFixed(2)),
      };
    });

    res.json({
      data,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
