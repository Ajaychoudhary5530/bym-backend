import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

/* =========================
   HELPERS
========================= */
const norm = (v) => String(v || "").trim().toLowerCase();

const makeSku = (name, usedSkus) => {
  let sku;
  do {
    const base = String(name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .replace(/\s+/g, "-");
    sku = `${base || "ITEM"}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (usedSkus.has(sku));

  usedSkus.add(sku);
  return sku;
};

/* =========================
   BULK UPLOAD
========================= */
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
        /* =========================
           LOAD EXISTING DATA
        ========================= */
        const products = await Product.find({}).lean();
        const inventories = await Inventory.find({}).lean();

        const productByKey = new Map();
        const inventoryByProductId = new Map();
        const usedSkus = new Set();

        products.forEach((p) => {
          productByKey.set(p.uniqueKey, p);
          usedSkus.add(p.sku);
        });

        inventories.forEach((i) => {
          inventoryByProductId.set(i.productId.toString(), i);
        });

        const newProducts = [];
        const newInventories = [];
        const stockLogs = [];

        let created = 0;

        /* =========================
           PROCESS CSV
        ========================= */
        rows.forEach((r, i) => {
          const rowNo = i + 2;

          if (
            !r.name ||
            !r.category ||
            !r.unit ||
            r.openingQty === undefined ||
            r.avgPurchasePrice === undefined
          ) {
            errors.push({ row: rowNo, error: "Missing required fields" });
            return;
          }

          const name = r.name.trim();
          const category = r.category.trim();
          const unit = r.unit.trim();
          const variant = r.variant ? r.variant.trim() : "";

          const openingQty = Number(r.openingQty);
          const price = Number(r.avgPurchasePrice);
          const minStock = Number(r.minStock || 0);

          if (
            isNaN(openingQty) ||
            openingQty < 0 ||
            isNaN(price) ||
            price < 0
          ) {
            errors.push({ row: rowNo, error: "Invalid numeric values" });
            return;
          }

          const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
            category
          )}|${norm(unit)}`;

          let product = productByKey.get(uniqueKey);

          /* =========================
             CREATE PRODUCT (IF NEW)
          ========================= */
          if (!product) {
            const sku = makeSku(name, usedSkus);

            product = {
              name,
              sku,
              category,
              unit,
              variant,
              minStock,
              uniqueKey,
            };

            newProducts.push(product);
            productByKey.set(uniqueKey, product);
            created++;
          }

          const productId =
            product._id || "__NEW__" + uniqueKey;

          /* =========================
             CREATE INVENTORY (OPENING ONLY)
          ========================= */
          if (!inventoryByProductId.has(productId.toString())) {
            newInventories.push({
              productId,
              openingQty,
              quantity: openingQty,
              avgPurchasePrice: Number(price.toFixed(2)),
              totalValue: Number((openingQty * price).toFixed(2)),
            });

            if (openingQty > 0) {
              stockLogs.push({
                productId,
                userId: req.user._id,
                type: "IN",
                quantity: openingQty,
                purchasePrice: price,
                remarks: "Opening Stock (CSV Upload)",
                date: new Date(),
              });
            }
          }
        });

        /* =========================
           WRITE TO DB
        ========================= */
        const insertedProducts = newProducts.length
          ? await Product.insertMany(newProducts)
          : [];

        const idMap = new Map();
        insertedProducts.forEach((p) =>
          idMap.set("__NEW__" + p.uniqueKey, p._id)
        );

        newInventories.forEach((inv) => {
          if (typeof inv.productId === "string") {
            inv.productId = idMap.get(inv.productId);
          }
        });

        if (newInventories.length) {
          await Inventory.insertMany(newInventories);
        }

        if (stockLogs.length) {
          stockLogs.forEach((log) => {
            if (typeof log.productId === "string") {
              log.productId = idMap.get(log.productId);
            }
          });
          await StockLog.insertMany(stockLogs);
        }

        fs.unlinkSync(req.file.path);

        res.json({
          message: "Bulk upload completed",
          created,
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
