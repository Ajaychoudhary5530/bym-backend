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
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://bym.vercel.app",        // ← your Vercel frontend
      "https://www.bym.co.in"          // ← your custom domain (future-proof)
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);


/* =========================
   STATIC FILES (PDF PREVIEW)
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This allows PDF preview in browser
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
