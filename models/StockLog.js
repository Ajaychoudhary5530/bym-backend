import mongoose from "mongoose";

const stockLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // IN / OUT
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },

    // NEW: IN type category (NEW stock or RETURN stock)
    stockType: {
      type: String,
      enum: ["NEW", "RETURN"],
      default: "NEW",
    },

    // NEW: Condition only for RETURN
    condition: {
      type: String,
      enum: ["GOOD", "DAMAGED", ""],
      default: "",
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    date: {
      type: Date,
      required: true,
    },

    // ✅ INVOICE DETAILS (Optional for NEW, not needed for RETURN)
    invoiceNo: {
      type: String,
      default: "",
    },

    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    invoicePdfUrl: {
      type: String,
      default: "",
    },

    // OUT SOURCE (Amazon / Others)
    source: {
      type: String,
      enum: ["AMAZON", "OTHERS"],
      required: function () {
        return this.type === "OUT";
      },
    },

    // Common remarks (works for Return also)
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("StockLog", stockLogSchema);
