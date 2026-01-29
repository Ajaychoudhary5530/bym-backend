import Product from "../models/Product.js";
import Inventory from "../models/Inventory.js";

/* =========================
   PRODUCTS WITH STOCK (FAST DASHBOARD)
========================= */
export const getProductsWithStock = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search || "";

    /* =========================
       SEARCH FILTER
    ========================= */
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(); // 🔥 faster

    const productIds = products.map((p) => p._id);

    /* =========================
       INVENTORY (SOURCE OF TRUTH)
    ========================= */
    const inventories = await Inventory.find({
      productId: { $in: productIds },
    }).lean(); // 🔥 faster

    const inventoryMap = {};
    inventories.forEach((inv) => {
      inventoryMap[String(inv.productId)] = inv;
    });

    /* =========================
       DASHBOARD RESPONSE
    ========================= */
    const data = products.map((p) => {
      const inv = inventoryMap[String(p._id)];

      const openingQty = inv?.openingQty || 0;
      const currentQty = inv?.quantity || 0;
      const avgPurchasePrice = inv?.avgPurchasePrice || 0;

      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        variant: p.variant,

        openingQty,
        currentQty,

        // counts removed from logs for speed
        qtyIn: 0,
        amazonOut: 0,
        othersOut: 0,

        minStock: p.minStock || 0,
        avgPurchasePrice,
        stockValue: Number((currentQty * avgPurchasePrice).toFixed(2)),
      };
    });

    res.json({
      data,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
