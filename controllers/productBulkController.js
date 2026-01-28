import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

const norm = (v) =>
  String(v || "").trim().toLowerCase();

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
          const tempInventory = [];
          const stockLogsToInsert = [];

          let created = 0;
          let updated = 0;

          rows.forEach((r, i) => {
            const rowNumber = i + 2;

            if (
              !r.name ||
              !r.category ||
              !r.unit ||
              r.openingQty === undefined ||
              r.avgPurchasePrice === undefined
            ) {
              errors.push({ row: rowNumber, error: "Missing required fields" });
              return;
            }

            const name = String(r.name).trim();
            const category = String(r.category).trim();
            const unit = String(r.unit).trim();
            const variant = r.variant ? String(r.variant).trim() : "";

            const openingQty = Number(r.openingQty);
            const avgPurchasePrice = Number(r.avgPurchasePrice);

            if (isNaN(openingQty) || isNaN(avgPurchasePrice)) {
              errors.push({ row: rowNumber, error: "Invalid numbers" });
              return;
            }

            const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
              category
            )}|${norm(unit)}`;

            if (!productMap.has(uniqueKey)) {
              const sku = makeSku(name, usedSkus);

              productsToInsert.push({
                name,
                sku,
                category,
                unit,
                variant,
                minStock: 0,
                uniqueKey,
              });

              tempInventory.push({
                uniqueKey,
                openingQty,
                avgPurchasePrice,
              });

              productMap.set(uniqueKey, true);
              created++;
            } else {
              updated++;
            }
          });

          const insertedProducts = await Product.insertMany(
            productsToInsert,
            { ordered: false }
          );

          const inventoryToInsert = [];

          insertedProducts.forEach((p) => {
            const inv = tempInventory.find(
              (i) => i.uniqueKey === p.uniqueKey
            );
            if (!inv) return;

            inventoryToInsert.push({
              productId: p._id,
              quantity: inv.openingQty,
              avgPurchasePrice: Number(inv.avgPurchasePrice.toFixed(2)),
              totalValue: Number(
                (inv.openingQty * inv.avgPurchasePrice).toFixed(2)
              ),
            });

            if (inv.openingQty > 0) {
              stockLogsToInsert.push({
                productId: p._id,
                userId: req.user._id,
                type: "IN",
                quantity: inv.openingQty,
                purchasePrice: inv.avgPurchasePrice,
                date: new Date(),
                remarks: "Opening Stock (Bulk Upload)",
              });
            }
          });

          if (inventoryToInsert.length) {
            await Inventory.insertMany(inventoryToInsert);
          }

          if (stockLogsToInsert.length) {
            await StockLog.insertMany(stockLogsToInsert);
          }

          fs.unlinkSync(req.file.path);

          res.json({
            message: "Bulk upload completed",
            created,
            updated,
            failed: errors.length,
            errors,
          });
        } catch (err) {
          console.error(err);
          fs.unlinkSync(req.file.path);
          res.status(500).json({ message: err.message });
        }
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
