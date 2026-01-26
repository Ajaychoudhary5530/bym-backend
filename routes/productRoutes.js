import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getProductsWithStock
} from "../controllers/productController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

// =========================
// PRODUCT ROUTES
// =========================

// Create product (Admin)
router.post("/", protect, adminOnly, createProduct);

// Get all products (basic)
router.get("/", protect, getProducts);

// 🔥 Products with current stock (Admin + User)
router.get("/with-stock", protect, getProductsWithStock);

// 🔴 Low stock products (Admin only)
router.get("/low-stock", protect, adminOnly, getLowStockProducts);

// Get product by ID
router.get("/:id", protect, getProductById);

// Update product (Admin)
router.put("/:id", protect, adminOnly, updateProduct);

// Delete product (Admin)
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
