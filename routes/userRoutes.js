import express from "express";
import {
  createUser,
  getUsers,
  toggleUserStatus
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", protect, adminOnly, createUser);
router.get("/", protect, adminOnly, getUsers);
router.patch("/:id/toggle", protect, adminOnly, toggleUserStatus);

export default router;
