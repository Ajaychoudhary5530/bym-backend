import User from "../models/User.js";
import bcrypt from "bcryptjs";

/**
 * CREATE USER (ADMIN)
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user"
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ALL USERS (ADMIN)
 */
export const getUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};

/**
 * ENABLE / DISABLE USER
 */
export const toggleUserStatus = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.isActive = !user.isActive;
  await user.save();

  res.json({
    message: `User ${user.isActive ? "enabled" : "disabled"}`
  });
};
