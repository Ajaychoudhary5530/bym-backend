import express from "express";
import multer from "multer";
import { bulkUploadProducts } from "../controllers/productBulkController.js";
import { protect } from "../middleware/authMiddleware.js";
import { superAdminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =========================
   BULK UPLOAD (SUPER ADMIN ONLY)
========================= */
router.post(
  "/bulk-upload",
  protect,
  superAdminOnly,
  upload.single("file"),
  bulkUploadProducts
);

export default router;
