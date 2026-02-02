import Counter from "../models/Counter.js";

const pad = (num, size = 4) => {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
};

export const generateSku = async (category = "", variant = "") => {
  const cat = category
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "GEN";

  const varnt = variant
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 2) || "NA";

  const counterId = `SKU_${cat}_${varnt}`;

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${cat}-${varnt}-${pad(counter.seq)}`;
};
