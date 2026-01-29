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

    /* =========================
       LOG TYPE
    ========================= */
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUST"],
      required: true,
    },

    /* =========================
       STOCK TYPE (IN ONLY)
    ========================= */
    stockType: {
      type: String,
      enum: ["NEW", "RETURN"],
      default: "NEW",
    },

    /* =========================
       RETURN CONDITION
    ========================= */
    condition: {
      type: String,
      enum: ["GOOD", "DAMAGED", ""],
      default: "",
    },

    /* =========================
       ADJUSTMENT INFO
    ========================= */
    adjustmentType: {
      type: String,
      enum: ["INCREASE", "DECREASE", ""],
      default: "",
    },

    adjustmentReason: {
      type: String,
      default: "",
    },

    /* =========================
       QUANTITY
    ========================= */
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    date: {
      type: Date,
      required: true,
    },

    /* =========================
       INVOICE DETAILS
    ========================= */
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

    /* =========================
       OUT SOURCE
    ========================= */
    source: {
      type: String,
      enum: ["AMAZON", "OTHERS"],
      required: function () {
        return this.type === "OUT";
      },
    },

    /* =========================
       COMMON REMARKS
    ========================= */
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("StockLog", stockLogSchema);
