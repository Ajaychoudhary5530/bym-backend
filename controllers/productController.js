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
    const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(category)}|${norm(unit)}`;

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
      quantity: Number(openingStock || 0),
      avgPurchasePrice: Number(purchasePrice || 0),
      totalValue: Number(openingStock || 0) * Number(purchasePrice || 0),
    });

    if (Number(openingStock) > 0) {
      await StockLog.create({
        productId: product._id,
        type: "IN",
        quantity: Number(openingStock),
        purchasePrice: Number(purchasePrice || 0),
        remarks: "Opening Stock",
        date: new Date(),
      });
    }

    res.status(201).json(product);
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    res.status(500).json({ message: "Create product failed" });
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

    const match = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      { $match: match },

      {
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "productId",
          as: "inventory",
        },
      },
      {
        $unwind: {
          path: "$inventory",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "stocklogs",
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$productId", "$$pid"] },
                    { $eq: ["$type", "IN"] },
                  ],
                },
              },
            },
            { $sort: { date: 1 } },
            { $limit: 1 },
          ],
          as: "openingLog",
        },
      },

      {
        $project: {
          _id: 1,
          name: 1,
          sku: 1,
          category: 1,
          unit: 1,
          variant: 1,
          minStock: 1,

          openingStock: {
            $ifNull: [{ $arrayElemAt: ["$openingLog.quantity", 0] }, 0],
          },

          quantity: { $ifNull: ["$inventory.quantity", 0] },
          avgPurchasePrice: {
            $ifNull: ["$inventory.avgPurchasePrice", 0],
          },
          totalValue: { $ifNull: ["$inventory.totalValue", 0] },
        },
      },

      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipeline = [{ $match: match }, { $count: "total" }];

    const [data, count] = await Promise.all([
      Product.aggregate(pipeline),
      Product.aggregate(countPipeline),
    ]);

    res.json({
      data,
      page,
      total: count[0]?.total || 0,
      pages: Math.ceil((count[0]?.total || 0) / limit),
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
