import mongoose from "mongoose";
import dotenv from "dotenv";
import Inventory from "../models/Inventory.js";
import StockLog from "../models/StockLog.js";
import Product from "../models/Product.js";

dotenv.config();

const resetInventory = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const products = await Product.find();

    for (const product of products) {
      let inventory = await Inventory.findOne({ productId: product._id });

      // Create inventory if missing
      if (!inventory) {
        inventory = await Inventory.create({
          productId: product._id,
          openingQty: 0,
          quantity: 0,
          avgPurchasePrice: 0,
        });
      }

      // Fetch all stock logs
      const logs = await StockLog.find({ productId: product._id });

      let totalIn = 0;
      let totalOut = 0;

      let totalPurchaseValue = 0;
      let totalPurchaseQty = 0;

      for (const log of logs) {
        if (log.type === "IN") {
          totalIn += log.quantity;

          // Only NEW stock affects avg price
          if (log.stockType === "NEW") {
            totalPurchaseQty += log.quantity;
            totalPurchaseValue += log.quantity * (log.purchasePrice || 0);
          }
        }

        if (log.type === "OUT") {
          totalOut += log.quantity;
        }
      }

      const newQty = inventory.openingQty + totalIn - totalOut;

      inventory.quantity = Math.max(newQty, 0);

      inventory.avgPurchasePrice =
        totalPurchaseQty > 0
          ? Number((totalPurchaseValue / totalPurchaseQty).toFixed(2))
          : inventory.avgPurchasePrice;

      await inventory.save();

      console.log(
        `🔄 ${product.name} → Qty: ${inventory.quantity}, Avg: ${inventory.avgPurchasePrice}`
      );
    }

    console.log("🎉 INVENTORY RESET COMPLETE");
    process.exit();
  } catch (err) {
    console.error("❌ RESET ERROR:", err);
    process.exit(1);
  }
};

resetInventory();
