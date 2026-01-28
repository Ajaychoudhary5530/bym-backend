import fs from "fs";
import csv from "csv-parser";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";

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
        const productById = new Map();
        const inventoryByProductId = new Map();
        const usedSkus = new Set();

        products.forEach((p) => {
          productByKey.set(p.uniqueKey, p);
          productById.set(p._id.toString(), p);
          usedSkus.add(p.sku);
        });

        inventories.forEach((i) => {
          inventoryByProductId.set(i.productId.toString(), i);
        });

        const newProducts = [];
        const newInventories = [];
        const inventoryUpdates = [];
        const stockLogs = [];

        let created = 0;
        let updated = 0;

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

          if (isNaN(openingQty) || isNaN(price)) {
            errors.push({ row: rowNo, error: "Invalid number values" });
            return;
          }

          const uniqueKey = `${norm(name)}|${norm(variant)}|${norm(
            category
          )}|${norm(unit)}`;

          let product = productByKey.get(uniqueKey);

          /* =========================
             NEW PRODUCT
          ========================= */
          if (!product) {
            const sku = makeSku(name, usedSkus);

            product = {
              name,
              sku,
              category,
              unit,
              variant,
              minStock: 0,
              uniqueKey,
            };

            newProducts.push(product);
            productByKey.set(uniqueKey, product);
            created++;
          }

          /* =========================
             INVENTORY
          ========================= */
          const productId =
            product._id || "__NEW__" + uniqueKey;

          const existingInv = inventoryByProductId.get(
            productId.toString()
          );

          if (!existingInv) {
            newInventories.push({
              productId,
              quantity: openingQty,
              avgPurchasePrice: Number(price.toFixed(2)),
              totalValue: Number((openingQty * price).toFixed(2)),
            });
          } else {
            const newQty = existingInv.quantity + openingQty;
            const newTotal =
              existingInv.totalValue + openingQty * price;

            inventoryUpdates.push({
              updateOne: {
                filter: { _id: existingInv._id },
                update: {
                  quantity: newQty,
                  totalValue: Number(newTotal.toFixed(2)),
                  avgPurchasePrice:
                    newQty > 0 ? Number((newTotal / newQty).toFixed(2)) : 0,
                },
              },
            });
          }

          if (openingQty > 0) {
            stockLogs.push({
              productId,
              userId: req.user._id,
              type: "IN",
              quantity: openingQty,
              purchasePrice: price,
              date: new Date(),
              remarks: "Opening Stock (Bulk Upload)",
            });
          }

          updated++;
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
          if (typeof inv.productId === "string" && inv.productId.startsWith("__NEW__")) {
            inv.productId = idMap.get(inv.productId);
          }
        });

        if (newInventories.length) {
          await Inventory.insertMany(newInventories);
        }

        if (inventoryUpdates.length) {
          await Inventory.bulkWrite(inventoryUpdates);
        }

        if (stockLogs.length) {
          await StockLog.insertMany(stockLogs);
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
        console.error("CSV BULK ERROR:", err);
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: err.message });
      }
    });
};
