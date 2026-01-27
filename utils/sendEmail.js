import nodemailer from "nodemailer";

export const sendOTPEmail = async (toEmail, otp) => {
  try {
    console.log("📧 Sending OTP to:", toEmail);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,          // ✅ IMPORTANT
      secure: true,       // ✅ MUST be true for 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Gmail APP password
      },

      // Prevent hanging forever
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.sendMail({
      from: `"BYM Inventory" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Your BYM Inventory Login OTP",
      html: `
        <div style="font-family: Arial, sans-serif">
          <h2>BYM Inventory Login</h2>
          <p>Your OTP is:</p>
          <h1 style="letter-spacing: 4px">${otp}</h1>
          <p>This OTP is valid for <b>5 minutes</b>.</p>
          <p>If you did not request this, ignore this email.</p>
        </div>
      `,
    });

    console.log("✅ OTP EMAIL SENT");
    return true;
  } catch (error) {
    console.error("❌ EMAIL SEND ERROR:", error.message);
    throw error;
  }
};
