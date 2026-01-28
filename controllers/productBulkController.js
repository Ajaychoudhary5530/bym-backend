import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   HELPERS
========================= */
const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

const makeSku = (name, usedSkus) => {
  let sku;
  do {
    const base = String(name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .replace(/\s+/g, "-");

    const rand = Math.floor(1000 + Math.random() * 9000);
    sku = `${base || "ITEM"}-${rand}`;
  } while (usedSkus.has(sku));

  usedSkus.add(sku);
  return sku;
};

/* =========================
   BULK UPLOAD
========================= */
export const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    const rows = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        try {
          /* =========================
             PRELOAD EXISTING DATA
          ========================= */
          const existingProducts = await Product.find(
            {},
            { uniqueKey: 1, sku: 1 }
          ).lean();

          const productMap = new Map();
          const usedSkus = new Set();

          existingProducts.forEach((p) => {
            productMap.set(p.uniqueKey, p);
            usedSkus.add(p.sku);
          });

          const productsToInsert = [];
          const inventoriesToInsert = [];
          const stockLogsToInsert = [];

          let created = 0;
          let updated = 0;

          /* =========================
             PROCESS CSV ROWS
          ========================= */
          rows.forEach((r, i) => {
            const rowNumber = i + 2;

            if (
              !r.name ||
              !r.category ||
              !r.unit ||
              r.openingQty === undefined ||
              r.avgPurchasePrice === undefined
            ) {
              errors.push({
                row: rowNumber,
                error:
                  "Missing required fields: name, category, unit, openingQty, avgPurchasePrice",
              });
              return;
            }

            const name = String(r.name).trim();
            const category = String(r.category).trim();
            const unit = String(r.unit).trim();
            const variant = r.variant ? String(r.variant).trim() : "";

            const openingQty = Number(r.openingQty);
            const avgPurchasePrice = Number(r.avgPurchasePrice);

            if (isNaN(openingQty) || openingQty < 0) {
              errors.push({ row: rowNumber, error: "Invalid openingQty" });
              return;
            }

            if (isNaN(avgPurchasePrice) || avgPurchasePrice < 0) {
              errors.push({
                row: rowNumber,
                error: "Invalid avgPurchasePrice",
              });
              return;
            }

            const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
              category
            )}|${norm(unit)}`;

            const existing = productMap.get(uniqueKey);

            if (!existing) {
              const sku = makeSku(name, usedSkus);

              const product = {
                name,
                sku,
                category,
                unit,
                variant,
                minStock: 0,
                uniqueKey,
              };

              productsToInsert.push(product);
              productMap.set(uniqueKey, product);
              created++;

              inventoriesToInsert.push({
                tempKey: uniqueKey,
                quantity: openingQty,
                avgPurchasePrice: Number(avgPurchasePrice.toFixed(2)),
                totalValue: Number(
                  (openingQty * avgPurchasePrice).toFixed(2)
                ),
              });
            } else {
              updated++;
            }
          });

          /* =========================
             INSERT PRODUCTS
          ========================= */
          const insertedProducts = await Product.insertMany(
            productsToInsert,
            { ordered: false }
          );

          const productIdMap = new Map();
          insertedProducts.forEach((p) =>
            productIdMap.set(p.uniqueKey, p._id)
          );

          /* =========================
             INVENTORY + STOCK LOGS
          ========================= */
          inventoriesToInsert.forEach((inv) => {
            const productId = productIdMap.get(inv.tempKey);
            if (!productId) return;

            inventoriesToInsert.push({
              productId,
              quantity: inv.quantity,
              avgPurchasePrice: inv.avgPurchasePrice,
              totalValue: inv.totalValue,
            });

            if (inv.quantity > 0) {
              stockLogsToInsert.push({
                productId,
                userId: req.user._id,
                type: "IN",
                quantity: inv.quantity,
                purchasePrice: inv.avgPurchasePrice,
                date: new Date(),
                remarks: "Opening Stock (Bulk Upload)",
              });
            }
          });

          if (inventoriesToInsert.length) {
            await Inventory.insertMany(inventoriesToInsert);
          }

          if (stockLogsToInsert.length) {
            await StockLog.insertMany(stockLogsToInsert);
          }

          fs.unlinkSync(req.file.path);

          return res.json({
            message: "Bulk upload completed",
            created,
            updated,
            failed: errors.length,
            errors,
          });
        } catch (err) {
          console.error("BULK UPLOAD ERROR:", err);
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}
          return res.status(500).json({ message: err.message });
        }
      });
  } catch (error) {
    console.error("BULK UPLOAD ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};
