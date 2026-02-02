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

    const data = products.map((p) => {
      const inv = inventoryMap[String(p._id)];

      const openingQty = inv?.openingQty || 0;
      const currentQty = inv?.quantity || 0;
      const avgPurchasePrice = inv?.avgPurchasePrice || 0;

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
        amazonOut: 0,
        othersOut: 0,

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
