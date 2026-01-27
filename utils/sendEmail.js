import nodemailer from "nodemailer";

export const sendOTPEmail = async (toEmail, otp) => {
  try {
    console.log("📧 Sending OTP to:", toEmail);

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: false, // true only for port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },

      // 🔥 CRITICAL: prevent hanging requests
      connectionTimeout: 10000, // 10 sec
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // ❌ DO NOT use transporter.verify() on Render

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
          <br/>
          <p>If you did not request this, please ignore.</p>
        </div>
      `,
    });

    console.log("✅ OTP email sent successfully");
    return true;
  } catch (error) {
    console.error("❌ EMAIL SEND ERROR:", error.message);
    throw new Error("Email sending failed");
  }
};
