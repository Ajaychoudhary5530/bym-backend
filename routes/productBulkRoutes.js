import express from "express";
import multer from "multer";
import { bulkUploadProducts } from "../controllers/productBulkController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/bulk-upload",
  protect,
  adminOnly,
  upload.single("file"),
  bulkUploadProducts
);

export default router;
