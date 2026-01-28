import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    // 🔑 OPENING STOCK (fixed once at first CSV upload)
    openingQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    // CURRENT STOCK
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    avgPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
