import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    // Opening stock (can be corrected by Super Admin)
    openingQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Current stock quantity (single source of truth)
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Weighted average purchase price
    avgPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
