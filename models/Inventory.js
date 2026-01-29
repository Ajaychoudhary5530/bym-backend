import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    // 🔑 Opening stock (SET ONCE – never update after creation)
    openingQty: {
      type: Number,
      default: 0,
      min: 0,
      immutable: true, // 🔒 very important
    },

    // ✅ SINGLE SOURCE OF TRUTH
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Weighted average purchase price
    avgPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
