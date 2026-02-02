import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import { generateSku } from "../utils/generateSku.js";

const normalizeKey = (key) =>
  key
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();

/* =========================
   BACKGROUND PROCESSOR
========================= */
const processCsvInBackground = async (filePath) => {
  const rows = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ mapHeaders: ({ header }) => normalizeKey(header) }))
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (!rows.length) return;

    /* ---------- Normalize ---------- */
    const normalized = rows
      .map((r) => {
        const name = String(r.name || "").trim();
        if (!name) return null;

        return {
          name,
          category: String(r.category || "").trim(),
          variant: String(r.variant || "").trim(),
          unit: String(r.unit || "Nos").trim(),
          minStock: Number(r.minstock) || 0,
          openingQty: Number(r.openingqty) || 0,
          openingPrice: Number(r.openingprice) || 0,
        };
      })
      .filter(Boolean);

    /* ---------- Generate SKU (PARALLEL) ---------- */
    await Promise.all(
      normalized.map(async (row) => {
        row.sku = await generateSku(row.category, row.variant);
        row.uniqueKey = row.sku.toLowerCase();
      }),
    );

    const skus = normalized.map((p) => p.sku);

    /* ---------- Filter existing ---------- */
    const existingProducts = await Product.find(
      { sku: { $in: skus } },
      { sku: 1 },
    );

    const existingSkuSet = new Set(existingProducts.map((p) => p.sku));

    const newProducts = normalized.filter((p) => !existingSkuSet.has(p.sku));

    /* ---------- Insert products ---------- */
    let createdProducts = [];

    if (newProducts.length) {
      try {
        createdProducts = await Product.insertMany(
          newProducts.map((p) => ({
            name: p.name,
            sku: p.sku,
            category: p.category,
            variant: p.variant,
            unit: p.unit,
            minStock: p.minStock,
            uniqueKey: p.uniqueKey,
          })),
          { ordered: false },
        );
      } catch (err) {
        if (err.insertedDocs) {
          createdProducts = err.insertedDocs;
        } else {
          throw err;
        }
      }
    }

    /* ---------- Inventory ---------- */
    const allProducts = await Product.find(
      { sku: { $in: skus } },
      { _id: 1, sku: 1 },
    );

    const sourceMap = new Map(normalized.map((n) => [n.sku, n]));

    const productIds = allProducts.map((p) => p._id);

    const existingInventory = await Inventory.find(
      { productId: { $in: productIds } },
      { productId: 1 },
    );

    const invSet = new Set(existingInventory.map((i) => String(i.productId)));

    const inventories = allProducts
      .filter((p) => !invSet.has(String(p._id)))
      .map((p) => {
        const source = sourceMap.get(p.sku);
        return {
          productId: p._id,
          openingQty: source?.openingQty || 0,
          quantity: source?.openingQty || 0,
          avgPurchasePrice: source?.openingPrice || 0,
        };
      });

    if (inventories.length) {
      await Inventory.insertMany(inventories, { ordered: false });
    }
  } catch (err) {
    console.error("BACKGROUND CSV ERROR:", err);
  } finally {
    fs.unlinkSync(filePath); // cleanup
  }
};

/* =========================
   API CONTROLLER
========================= */
export const bulkUploadProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file required" });
  }

  // 🔥 RESPOND IMMEDIATELY
  res.json({
    message: "Upload accepted. Processing started in background.",
  });

  // 🚀 PROCESS IN BACKGROUND
  setImmediate(() => {
    processCsvInBackground(req.file.path);
  });
};
