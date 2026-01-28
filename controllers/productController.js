import mongoose from "mongoose";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

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
      purchasePrice,
      minStock,
    } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ message: "Name and SKU are required" });
    }

    const norm = (v) => String(v || "").trim().toLowerCase();
    const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(category)}|${norm(
      unit
    )}`;

    if (await Product.findOne({ sku: sku.trim() })) {
      return res.status(400).json({ message: "SKU already exists" });
    }

    if (await Product.findOne({ uniqueKey })) {
      return res.status(400).json({
        message: "Product already exists (same name + variant + category + unit)",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim(),
      category,
      unit,
      variant,
      minStock: Number(minStock || 0),
      uniqueKey,
    });

    await Inventory.create({
      productId: product._id,
      openingQty: Number(openingStock || 0),
      quantity: Number(openingStock || 0),
      avgPurchasePrice: Number(purchasePrice || 0),
      totalValue:
        Number(openingStock || 0) * Number(purchasePrice || 0),
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

    const product = await Product.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
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
    await StockLog.deleteMany({ productId: product._id });
    await product.deleteOne();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * LOW STOCK PRODUCTS
 * =========================
 */
export const getLowStockProducts = async (req, res) => {
  try {
    const data = await Inventory.aggregate([
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
          quantity: "$quantity",
          minStock: "$product.minStock",
        },
      },
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * =========================
 * PRODUCTS WITH STOCK (DASHBOARD)
 * =========================
 */
export const getProductsWithStock = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search?.trim() || "";
    const skip = (page - 1) * limit;

    const matchProduct = search
      ? {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.sku": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: matchProduct },

      {
        $lookup: {
          from: "stocklogs",
          let: { pid: "$productId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
            {
              $group: {
                _id: null,
                qtyIn: {
                  $sum: {
                    $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0],
                  },
                },
                amazonOut: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$type", "OUT"] },
                          { $eq: ["$source", "AMAZON"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                },
                othersOut: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$type", "OUT"] },
                          { $eq: ["$source", "OTHERS"] },
                        ],
                      },
                      "$quantity",
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: "logs",
        },
      },
      {
        $addFields: {
          logs: { $ifNull: [{ $arrayElemAt: ["$logs", 0] }, {}] },
        },
      },

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

          openingQty: "$openingQty",
          currentQty: "$quantity",

          qtyIn: "$logs.qtyIn",
          amazonOut: "$logs.amazonOut",
          othersOut: "$logs.othersOut",

          minStock: "$product.minStock",
          avgPurchasePrice: "$avgPurchasePrice",
          stockValue: "$totalValue",
        },
      },
    ];

    const countPipeline = [
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: matchProduct },
      { $count: "total" },
    ];

    const [data, countResult] = await Promise.all([
      Inventory.aggregate(pipeline),
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
    console.error("DASHBOARD ERROR:", error.message);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
