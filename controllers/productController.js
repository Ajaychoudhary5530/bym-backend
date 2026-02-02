import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import { generateSku } from "../utils/generateSku.js";

/* =========================
   CREATE PRODUCT (ADMIN / SUPERADMIN)
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

    /* =========================
       SKU AUTO-GENERATION
    ========================= */
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

    /* =========================
       CREATE INVENTORY
    ========================= */
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
   PRODUCTS WITH STOCK (FAST DASHBOARD)
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

    const inventories = await Inventory.find({
      productId: { $in: productIds },
    }).lean();

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[String(inv.productId)] = inv;
    });

    let data = products.map((p) => {
      const inv = inventoryMap[String(p._id)];

      const openingQty = inv?.openingQty || 0;
      const currentQty = inv?.quantity || 0;
      const avgPurchasePrice = inv?.avgPurchasePrice || 0;

      const amazonOut = inv?.amazonOut || 0;
      const othersOut = inv?.othersOut || 0;

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        variant: p.variant,
        unit: p.unit,

        openingQty,
        currentQty,

        qtyIn: 0,
        amazonOut,
        othersOut,

        totalSold: amazonOut + othersOut, // 🔥 IMPORTANT
        minStock: p.minStock || 0,
        avgPurchasePrice,
        stockValue: Number((currentQty * avgPurchasePrice).toFixed(2)),
      };
    });

    /* =========================
       🔥 TOP 50 SELLING FILTER
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
       NORMAL PAGINATION
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
