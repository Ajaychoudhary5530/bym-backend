import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    // Current available stock
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Weighted Average Purchase Price
    avgPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Total inventory value (quantity × avgPurchasePrice)
    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
