import mongoose from "mongoose";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";

/**
 * =========================
 * CREATE PRODUCT (ADMIN)
 * =========================
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      unit,
      variant,
      openingStock,
      price,
      purchasePrice,
      minStock,
    } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ message: "Name and SKU are required" });
    }

    // ✅ normalize helper
    const norm = (v) => String(v || "").trim().toLowerCase();

    // ✅ uniqueKey auto-generate
    const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(category)}|${norm(
      unit
    )}`;

    // SKU uniqueness
    const existingSku = await Product.findOne({ sku: sku.trim() });
    if (existingSku) {
      return res.status(400).json({ message: "SKU already exists" });
    }

    // UniqueKey uniqueness (prevents duplicates)
    const existingKey = await Product.findOne({ uniqueKey });
    if (existingKey) {
      return res.status(400).json({
        message: "Product already exists (same name + variant + category + unit)",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim(),
      category: category || "",
      unit: unit || "Nos",
      variant: variant || "",
      minStock: Number(minStock || 0),
      uniqueKey,
    });

    // Auto-create inventory (set opening stock as initial quantity)
    await Inventory.create({
      productId: product._id,
      quantity: Number(openingStock || 0),
      avgPurchasePrice: Number(purchasePrice || 0),
      totalValue: Number(openingStock || 0) * Number(purchasePrice || 0),
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};


/**
 * =========================
 * GET ALL PRODUCTS
 * =========================
 */
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * GET PRODUCT BY ID
 * =========================
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("GET PRODUCT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * UPDATE PRODUCT (ADMIN)
 * =========================
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(product, req.body);
    await product.save();

    res.json(product);
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * DELETE PRODUCT (ADMIN)
 * =========================
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Inventory.deleteOne({ productId: product._id });
    await product.deleteOne();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * LOW STOCK PRODUCTS (ADMIN)
 * =========================
 */
export const getLowStockProducts = async (req, res) => {
  try {
    const lowStock = await Inventory.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $match: {
          $expr: { $lte: ["$quantity", "$product.minStock"] },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$product._id",
          name: "$product.name",
          sku: "$product.sku",
          quantity: 1,
          minStock: "$product.minStock",
        },
      },
    ]);

    res.json(lowStock);
  } catch (error) {
    console.error("LOW STOCK ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * PRODUCTS WITH STOCK
 * =========================
 */
export const getProductsWithStock = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search?.trim() || "";
    const skip = (page - 1) * limit;

    const matchStage = search
      ? {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.sku": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const basePipeline = [
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: matchStage },
    ];

    const dataPipeline = [
      ...basePipeline,
      { $sort: { "product.createdAt": -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          sku: "$product.sku",
          category: "$product.category",
          unit: "$product.unit",
          variant: "$product.variant",
          minStock: "$product.minStock",
          quantity: "$quantity",
          avgPurchasePrice: "$avgPurchasePrice",
          totalValue: "$totalValue",
        },
      },
    ];

    const countPipeline = [
      ...basePipeline,
      { $count: "total" },
    ];

    const [data, countResult] = await Promise.all([
      Inventory.aggregate(dataPipeline),
      Inventory.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total || 0;

    res.json({
      data,
      page,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("PRODUCTS WITH STOCK ERROR:", error.message);
    res.status(500).json({ message: "Failed to load dashboard products" });
  }
};
