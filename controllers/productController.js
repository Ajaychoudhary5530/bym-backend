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

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    Object.assign(product, req.body);
    await product.save();

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
          quantity: 1,
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
    const skip = (page - 1) * limit;

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

      // 🔑 AMAZON / OTHERS OUT
      {
        $lookup: {
          from: "stocklogs",
          let: { pid: "$productId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$pid"] },
                type: "OUT",
              },
            },
            {
              $group: {
                _id: "$source",
                qty: { $sum: "$quantity" },
              },
            },
          ],
          as: "outStats",
        },
      },

      {
        $addFields: {
          amazonOut: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$outStats",
                    as: "o",
                    cond: { $eq: ["$$o._id", "AMAZON"] },
                  },
                },
                as: "f",
                in: "$$f.qty",
              },
            },
          },
          othersOut: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$outStats",
                    as: "o",
                    cond: { $eq: ["$$o._id", "OTHERS"] },
                  },
                },
                as: "f",
                in: "$$f.qty",
              },
            },
          },
        },
      },

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

          qtyIn: {
            $subtract: ["$quantity", "$openingQty"],
          },

          amazonOut: { $ifNull: ["$amazonOut", 0] },
          othersOut: { $ifNull: ["$othersOut", 0] },

          minStock: "$product.minStock",
          avgPurchasePrice: "$avgPurchasePrice",
          stockValue: "$totalValue",
        },
      },

      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const data = await Inventory.aggregate(pipeline);
    const total = await Inventory.countDocuments();

    res.json({
      data,
      page,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard load failed" });
  }
};
