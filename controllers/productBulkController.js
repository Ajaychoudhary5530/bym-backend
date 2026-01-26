import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

// ✅ normalize helper
const norm = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();

// ✅ SKU generator (simple + unique)
const makeSku = (name) => {
  const base = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, "-");

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base || "ITEM"}-${rand}`;
};

export const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    const rows = [];
    const errors = [];
    let created = 0;
    let updated = 0;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        try {
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rowNumber = i + 2;

            // Required fields
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
              continue;
            }

            const name = String(r.name).trim();
            const category = String(r.category).trim();
            const unitRaw = String(r.unit).trim();
            const allowedUnits = ["Nos", "Pcs", "Unit", "Set", "Pair", "Box"];

            const unit = allowedUnits.includes(unitRaw) ? unitRaw : null;

            if (!unit) {
              errors.push({
                row: rowNumber,
                error: `Invalid unit "${unitRaw}". Allowed: ${allowedUnits.join(", ")}`,
              });
              continue;
            }
            const variant = r.variant ? String(r.variant).trim() : "";

            const openingQty = Number(r.openingQty);
            const avgPurchasePrice = Number(r.avgPurchasePrice);

            if (isNaN(openingQty) || openingQty < 0) {
              errors.push({ row: rowNumber, error: "Invalid openingQty" });
              continue;
            }

            if (isNaN(avgPurchasePrice) || avgPurchasePrice < 0) {
              errors.push({
                row: rowNumber,
                error: "Invalid avgPurchasePrice",
              });
              continue;
            }

            // ✅ uniqueKey prevents duplicates (case-insensitive)
            const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
              category,
            )}|${norm(unit)}`;

            // Find existing product
            let product = await Product.findOne({ uniqueKey });

            if (!product) {
              // Create new product
              let sku = makeSku(name);
              let skuExists = await Product.findOne({ sku });

              while (skuExists) {
                sku = makeSku(name);
                skuExists = await Product.findOne({ sku });
              }

              product = await Product.create({
                name,
                sku,
                category,
                unit,
                variant,
                minStock: 0,
                uniqueKey,
              });

              await Inventory.create({
                productId: product._id,
                quantity: openingQty,
                avgPurchasePrice: Number(avgPurchasePrice.toFixed(2)),
                totalValue: Number((openingQty * avgPurchasePrice).toFixed(2)),
              });

              created++;
            } else {
              // Update inventory for existing product
              const inventory = await Inventory.findOne({
                productId: product._id,
              });

              if (!inventory) {
                await Inventory.create({
                  productId: product._id,
                  quantity: openingQty,
                  avgPurchasePrice: Number(avgPurchasePrice.toFixed(2)),
                  totalValue: Number(
                    (openingQty * avgPurchasePrice).toFixed(2),
                  ),
                });
              } else {
                inventory.quantity += openingQty;
                inventory.totalValue += openingQty * avgPurchasePrice;

                inventory.avgPurchasePrice =
                  inventory.quantity > 0
                    ? inventory.totalValue / inventory.quantity
                    : 0;

                inventory.avgPurchasePrice = Number(
                  inventory.avgPurchasePrice.toFixed(2),
                );
                inventory.totalValue = Number(inventory.totalValue.toFixed(2));

                await inventory.save();
              }

              updated++;
            }

            // Opening stock log
            if (openingQty > 0) {
              await StockLog.create({
                productId: product._id,
                userId: req.user._id,
                type: "IN",
                quantity: openingQty,
                purchasePrice: avgPurchasePrice,
                date: new Date(),
                remarks: "Opening Stock (Bulk Upload)",
              });
            }
          }

          fs.unlinkSync(req.file.path);

          return res.json({
            message: "Bulk upload completed",
            created,
            updated,
            failed: errors.length,
            errors,
          });
        } catch (innerErr) {
          console.error("BULK UPLOAD LOOP ERROR:", innerErr);

          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}

          return res.status(500).json({
            message: "Bulk upload failed",
            error: innerErr.message,
          });
        }
      });
  } catch (error) {
    console.error("BULK UPLOAD ERROR:", error);

    return res.status(500).json({
      message: "Bulk upload failed",
      error: error.message,
    });
  }
};
