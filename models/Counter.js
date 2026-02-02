import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: {
    type: String, // example: SKU_RESMED_NA
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export default mongoose.model("Counter", counterSchema);
