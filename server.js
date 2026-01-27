import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productBulkRoutes from "./routes/productBulkRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import resetRoutes from "./routes/resetRoutes.js";

dotenv.config();
connectDB();

const app = express();

/* =========================
   CORS (FIXED)
========================= */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://bym-frontend.vercel.app", // ✅ ACTUAL VERCEL DOMAIN
    "https://bym.vercel.app",
    "https://www.bym.co.in"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ✅ VERY IMPORTANT (preflight fix)
app.options("*", cors());

/* =========================
   BODY PARSER
========================= */
app.use(express.json());

/* =========================
   STATIC FILES
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productBulkRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin/reset", resetRoutes);

app.get("/", (req, res) => {
  res.send("Inventory API Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
