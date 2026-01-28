import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

const norm = (v) => String(v || "").trim().toLowerCase();

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

          if (isNaN(openingQty) || isNaN(price)) {
            errors.push({ row: rowNo, error: "Invalid numbers" });
            continue;
          }

          const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
            category
          )}|${norm(unit)}`;

          let product = await Product.findOne({ uniqueKey });

          if (!product) {
            product = await Product.create({
              name,
              sku: `${name.replace(/\s+/g, "-").toUpperCase()}-${Date.now()}`,
              category,
              unit,
              variant,
              minStock,
              uniqueKey,
            });
          }

          let inventory = await Inventory.findOne({ productId: product._id });

          // 🔑 FIRST TIME → SET OPENING
          if (!inventory) {
            inventory = await Inventory.create({
              productId: product._id,
              openingQty,
              quantity: openingQty,
              avgPurchasePrice: price,
              totalValue: openingQty * price,
            });
          }

          // 🔑 Opening Stock Log (ONLY ONCE)
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

        fs.unlinkSync(req.file.path);

        res.json({
          message: "CSV upload completed",
          failed: errors.length,
          errors,
        });
      } catch (err) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: err.message });
      }
    });
};
