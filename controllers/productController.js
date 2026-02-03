import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";
import { generateSku } from "../utils/generateSku.js";

/* =========================
   CREATE PRODUCT
========================= */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      variant,
      unit,
      minStock,
      openingQty,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Product name required" });
    }

    let finalSku = sku?.trim();
    if (!finalSku) {
      finalSku = await generateSku(category, variant);
    }

    const exists = await Product.findOne({ sku: finalSku });
    if (exists) {
      return res.status(400).json({ message: "SKU already exists" });
    }

    const product = await Product.create({
      name: name.trim(),
      sku: finalSku,
      category: category?.trim() || "",
      variant: variant?.trim() || "",
      unit: unit || "Nos",
      minStock: Number(minStock) || 0,
      uniqueKey: finalSku.toLowerCase(),
    });

    const qty = Number(openingQty) || 0;

    await Inventory.create({
      productId: product._id,
      openingQty: qty,
      quantity: qty,
      avgPurchasePrice: 0,
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (err) {
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ message: "Failed to create product" });
  }
};

/* =========================
   PRODUCTS WITH STOCK (DASHBOARD)
========================= */
export const getProductsWithStock = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search || "";
    const topSelling = req.query.topSelling === "1";

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const productIds = products.map((p) => p._id);

    /* =========================
       INVENTORY MAP
    ========================= */
    const inventories = await Inventory.find({
      productId: { $in: productIds },
    }).lean();

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[String(inv.productId)] = inv;
    });

    /* =========================
       STOCK LOG AGGREGATION
    ========================= */
    const stockAgg = await StockLog.aggregate([
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: {
            productId: "$productId",
            type: "$type",
            source: "$source",
          },
          totalQty: { $sum: "$quantity" },
        },
      },
    ]);

    const stockMap = {};
    stockAgg.forEach((row) => {
      const pid = String(row._id.productId);
      if (!stockMap[pid]) {
        stockMap[pid] = {
          qtyIn: 0,
          amazonOut: 0,
          othersOut: 0,
        };
      }

      if (row._id.type === "IN") {
        stockMap[pid].qtyIn += row.totalQty;
      }

      if (row._id.type === "OUT") {
        if (row._id.source === "AMAZON") {
          stockMap[pid].amazonOut += row.totalQty;
        } else {
          stockMap[pid].othersOut += row.totalQty;
        }
      }
    });

    /* =========================
       BUILD RESPONSE
    ========================= */
    let data = products.map((p) => {
      const inv = inventoryMap[String(p._id)] || {};
      const stock = stockMap[String(p._id)] || {};

      const openingQty = inv.openingQty || 0;
      const currentQty = inv.quantity || 0;
      const avgPurchasePrice = inv.avgPurchasePrice || 0;

      const amazonOut = stock.amazonOut || 0;
      const othersOut = stock.othersOut || 0;

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        variant: p.variant,
        unit: p.unit,

        openingQty,
        currentQty,

        qtyIn: stock.qtyIn || 0,
        amazonOut,
        othersOut,

        totalSold: amazonOut + othersOut, // 🔥 USED FOR TOP SELLING
        minStock: p.minStock || 0,
        avgPurchasePrice,
        stockValue: Number((currentQty * avgPurchasePrice).toFixed(2)),
      };
    });

    /* =========================
       TOP 50 SELLING
    ========================= */
    if (topSelling) {
      data = data
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 50);

      return res.json({
        data,
        page: 1,
        pages: 1,
        total: data.length,
      });
    }

    /* =========================
       PAGINATION
    ========================= */
    const start = (page - 1) * limit;
    const end = start + limit;

    res.json({
      data: data.slice(start, end),
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
