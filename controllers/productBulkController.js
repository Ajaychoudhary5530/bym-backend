import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import { generateSku } from "../utils/generateSku.js";

const normalizeKey = (key) =>
  key.replace(/^\uFEFF/, "").trim().toLowerCase();

export const bulkUploadProducts = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file required" });
  }

  const rows = [];

  try {
    fs.createReadStream(req.file.path)
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeKey(header),
        })
      )
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        try {
          if (!rows.length) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "CSV empty" });
          }

          /* ---------- Normalize CSV (IGNORE CSV SKU) ---------- */
          const normalized = rows
            .map((r) => {
              const name = String(r.name || "").trim();

              return {
                name,
                sku: "", // 🔥 FORCE AUTO SKU
                category: String(r.category || "").trim(),
                variant: String(r.variant || "").trim(),
                unit: String(r.unit || "Nos").trim(),
                minStock: Number(r.minstock) || 0,
                openingQty: Number(r.openingqty) || 0,
                openingPrice: Number(r.openingprice) || 0,
              };
            })
            .filter((r) => r.name); // only name required

          if (!normalized.length) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
              message: "No valid rows found. Check CSV headers and values.",
            });
          }

          /* ---------- ALWAYS GENERATE SKU ---------- */
          for (const row of normalized) {
            row.sku = await generateSku(row.category, row.variant);
            row.uniqueKey = row.sku.toLowerCase();
          }

          const skus = normalized.map((p) => p.sku);

          /* ---------- Existing products ---------- */
          const existingProducts = await Product.find(
            { sku: { $in: skus } },
            { sku: 1 }
          );

          const existingSkuSet = new Set(existingProducts.map((p) => p.sku));

          /* ---------- New products only ---------- */
          const newProducts = normalized.filter(
            (p) => !existingSkuSet.has(p.sku)
          );

          let createdProducts = [];

          /* ---------- SAFE INSERT (PARTIAL OK) ---------- */
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
                { ordered: false }
              );
            } catch (err) {
              // ✅ allow partial success
              if (err.insertedDocs) {
                createdProducts = err.insertedDocs;
              } else {
                throw err;
              }
            }
          }

          /* ---------- Ensure inventory ---------- */
          const allProducts = await Product.find(
            { sku: { $in: skus } },
            { _id: 1, sku: 1 }
          );

          const productIds = allProducts.map((p) => p._id);

          const existingInventory = await Inventory.find(
            { productId: { $in: productIds } },
            { productId: 1 }
          );

          const invSet = new Set(
            existingInventory.map((i) => String(i.productId))
          );

          const inventories = allProducts
            .filter((p) => !invSet.has(String(p._id)))
            .map((p) => {
              const source = normalized.find((x) => x.sku === p.sku);
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

          fs.unlinkSync(req.file.path);

          return res.json({
            message: "Bulk upload successful",
            productsInserted: createdProducts.length,
            inventoriesCreated: inventories.length,
          });
        } catch (err) {
          console.error("CSV PROCESS ERROR:", err);
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ message: "CSV processing failed" });
        }
      });
  } catch (err) {
    console.error("BULK UPLOAD ERROR:", err);
    fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: "Bulk upload failed" });
  }
};
