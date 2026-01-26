import express from "express";
import multer from "multer";
import path from "path";

import {
  stockIn,
  stockOut,
  getStockHistory,
  exportStockHistory,
} from "../controllers/stockController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* =========================
   MULTER CONFIG (PDF ONLY)
========================= */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/invoices");
  },
  filename(req, file, cb) {
    cb(
      null,
      `invoice-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

/* =========================
   UPLOAD INVOICE PDF
========================= */
router.post(
  "/upload-invoice",
  protect,
  adminOnly,
  (req, res) => {
    upload.single("invoice")(req, res, function (err) {
      if (err) {
        return res.status(400).json({
          message: err.message || "Invoice upload failed",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      res.json({
        pdfUrl: `/uploads/invoices/${req.file.filename}`,
      });
    });
  }
);

/* =========================
   STOCK ROUTES
========================= */
router.post("/in", protect, adminOnly, stockIn);
router.post("/out", protect, stockOut);
router.get("/history", protect, getStockHistory);
router.get("/export", protect, exportStockHistory);

export default router;
