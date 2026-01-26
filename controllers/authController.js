import jwt from "jsonwebtoken";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { sendOTPEmail } from "../utils/sendEmail.js";

/**
 * SEND OTP
 * Only for EXISTING users
 */
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      return res.status(403).json({
        message: "Access denied. Contact admin."
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.findOneAndUpdate(
      { email },
      {
        email,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      },
      { upsert: true }
    );

    await sendOTPEmail(email, otp);

    res.json({ message: "OTP sent" });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

/**
 * VERIFY OTP
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await OTP.findOne({ email });
    if (!record) {
      return res.status(400).json({ message: "OTP not found" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(403).json({ message: "Access denied" });
    }

    await OTP.deleteOne({ email });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
