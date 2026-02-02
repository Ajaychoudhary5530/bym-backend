import express from "express";
import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";

const router = express.Router();

/* =========================
   DEV TEST: CREATE PRODUCT + INVENTORY
========================= */
router.get("/create-test-inventory", async (req, res) => {
  try {
    // 1️⃣ Create product
    const product = await Product.create({
      name: "DEV TEST PRODUCT",
      sku: "DEV-TEST-001",
      category: "TEST",
      variant: "TEST",
      unit: "Nos",
      minStock: 1,
      uniqueKey: "dev-test-001",
    });

    // 2️⃣ Create inventory
    const inventory = await Inventory.create({
      productId: product._id,
      openingQty: 10,
      quantity: 10,
      avgPurchasePrice: 100,
    });

    res.json({
      message: "✅ Test product & inventory created",
      product,
      inventory,
    });
  } catch (err) {
    console.error("DEV TEST ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
