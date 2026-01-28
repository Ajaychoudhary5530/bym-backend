import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

// normalize helper
const norm = (v) => String(v || "").trim().toLowerCase();

// safe SKU generator
const makeSku = (name) => {
  const base = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, "-");

  return `${base}-${Math.floor(100000 + Math.random() * 900000)}`;
};

export const bulkUploadProducts = async (req, res) => {
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
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const rowNo = i + 2;

          if (
            !r.name ||
            !r.category ||
            !r.unit ||
            r.openingQty === undefined ||
            r.avgPurchasePrice === undefined
          ) {
            errors.push({ row: rowNo, error: "Missing required fields" });
            continue;
          }

          const name = r.name.trim();
          const category = r.category.trim();
          const unit = r.unit.trim();
          const variant = r.variant?.trim() || "NA";
          const openingQty = Number(r.openingQty);
          const price = Number(r.avgPurchasePrice);
          const minStock = Number(r.minStock || 0);

          if (isNaN(openingQty) || openingQty < 0 || isNaN(price) || price < 0) {
            errors.push({ row: rowNo, error: "Invalid numeric values" });
            continue;
          }

          const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
            category
          )}|${norm(unit)}`;

          /* =========================
             PRODUCT
          ========================= */
          let product = await Product.findOne({ uniqueKey });

          if (!product) {
            product = await Product.create({
              name,
              sku: makeSku(name),
              category,
              unit,
              variant,
              minStock,
              uniqueKey,
            });
          } else {
            // 🔒 Rule: CSV re-upload updates ONLY minStock
            if (product.minStock !== minStock) {
              product.minStock = minStock;
              await product.save();
            }
          }

          /* =========================
             INVENTORY
          ========================= */
          let inventory = await Inventory.findOne({ productId: product._id });

          // ✅ FIRST TIME ONLY → set opening
          if (!inventory) {
            inventory = await Inventory.create({
              productId: product._id,
              openingQty,
              quantity: openingQty,
              avgPurchasePrice: price,
              totalValue: openingQty * price,
            });

            // ✅ Opening Stock log ONLY ONCE
            if (openingQty > 0) {
              await StockLog.create({
                productId: product._id,
                userId: req.user._id,
                type: "IN",
                stockType: "NEW",
                quantity: openingQty,
                purchasePrice: price,
                date: new Date(),
                remarks: "Opening Stock (CSV Upload)",
              });
            }
          }
        }

        fs.unlinkSync(req.file.path);

        res.json({
          message: "CSV upload completed",
          failed: errors.length,
          errors,
        });
      } catch (err) {
        console.error("CSV BULK ERROR:", err);
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: err.message });
      }
    });
};
