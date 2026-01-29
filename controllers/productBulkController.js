import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";

export const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    const rows = [];

    /* =========================
       READ CSV (STREAM)
    ========================= */
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", async () => {
        try {
          if (rows.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
              message: "CSV is empty or has no valid rows",
            });
          }

          /* =========================
             NORMALIZE + FILTER
          ========================= */
          const normalized = rows
            .map((r) => ({
              name: r.name?.trim(),
              sku: r.sku?.trim(),
              category: (r.category || "").trim(),
              variant: (r.variant || "").trim(),
              unit: r.unit || "Nos",
              minStock: Number(r.minStock) || 0,
              openingQty: Number(r.openingQty) || 0,
              uniqueKey: r.sku?.trim()?.toLowerCase(),
            }))
            .filter((r) => r.name && r.sku);

          if (normalized.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
              message: "CSV has no valid product rows",
            });
          }

          /* =========================
             REMOVE EXISTING SKUs (ONE DB HIT)
          ========================= */
          const skus = normalized.map((p) => p.sku);

          const existingProducts = await Product.find(
            { sku: { $in: skus } },
            { sku: 1 }
          );

          const existingSkuSet = new Set(
            existingProducts.map((p) => p.sku)
          );

          const newProducts = normalized.filter(
            (p) => !existingSkuSet.has(p.sku)
          );

          if (newProducts.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
              message: "All products already exist (duplicate SKUs)",
            });
          }

          /* =========================
             BULK INSERT PRODUCTS
          ========================= */
          const createdProducts = await Product.insertMany(
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

          /* =========================
             BULK INSERT INVENTORY
          ========================= */
          const inventories = createdProducts.map((p) => {
            const source = newProducts.find(
              (x) => x.sku === p.sku
            );

            const qty = Number(source.openingQty) || 0;

            return {
              productId: p._id,
              openingQty: qty,
              quantity: qty,
              avgPurchasePrice: 0,
              totalValue: 0,
            };
          });

          await Inventory.insertMany(inventories, { ordered: false });

          fs.unlinkSync(req.file.path);

          res.json({
            message: "Bulk upload successful",
            uploaded: createdProducts.length,
            skipped: existingSkuSet.size,
          });
        } catch (innerErr) {
          console.error("CSV PROCESS ERROR:", innerErr);
          fs.unlinkSync(req.file.path);
          res.status(500).json({ message: "CSV processing failed" });
        }
      });
  } catch (err) {
    console.error("BULK UPLOAD ERROR:", err);
    res.status(500).json({ message: "Bulk upload failed" });
  }
};
