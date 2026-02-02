import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";
import { createProduct, getProductsWithStock } from "../controllers/productController.js";

const router = express.Router();

// CREATE SINGLE PRODUCT
router.post("/", protect, adminOnly, createProduct);

// DASHBOARD
router.get("/with-stock", protect, getProductsWithStock);

export default router;
