import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    sku: { type: String, required: true, unique: true },

    category: { type: String, default: "" },

    // ✅ NEW: Variant
    variant: { type: String, default: "" },

    // ✅ UOM (restricted)
    unit: {
      type: String,
      enum: ["Nos", "Pcs", "Unit", "Set", "Pair", "Box"],
      default: "Nos",
      required: true,
    },

    minStock: { type: Number, default: 0 },

    // ✅ NEW: Unique key to prevent duplicates
    uniqueKey: { type: String, unique: true, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
