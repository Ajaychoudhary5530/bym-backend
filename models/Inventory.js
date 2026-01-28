import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    // 🔗 Reference to Product
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    // 🟦 OPENING STOCK
    // Set ONLY once during fresh CSV upload
    openingQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 🟩 CURRENT STOCK (single source of truth)
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 💰 Average purchase price
    avgPurchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 💵 Total stock value (quantity * avgPurchasePrice)
    totalValue: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Inventory", inventorySchema);
