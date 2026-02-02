import Product from "../models/Product.js";

const normalize = (v, len = 4) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, len) || "GEN";

export const generateSku = async (category, variant) => {
  const cat = normalize(category);
  const varr = normalize(variant);

  const prefix = variant ? `${cat}-${varr}` : cat;

  // find latest SKU with same prefix
  const last = await Product.findOne({
    sku: { $regex: `^${prefix}-\\d{4}$` },
  })
    .sort({ sku: -1 })
    .select("sku")
    .lean();

  let next = 1;

  if (last?.sku) {
    const num = Number(last.sku.split("-").pop());
    if (!isNaN(num)) next = num + 1;
  }

  const sequence = String(next).padStart(4, "0");

  return `${prefix}-${sequence}`;
};
