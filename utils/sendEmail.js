import nodemailer from "nodemailer";

export const sendOTPEmail = async (to, otp) => {
  try {
    console.log("📧 Sending OTP to:", to);

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Inventory System" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your Login OTP",
      html: `
        <div style="font-family:Arial,sans-serif">
          <h3>BYM-Inventory App : Login OTP</h3>
          <p>Your OTP is:</p>
          <h2 style="letter-spacing:2px">${otp}</h2>
          <p>This OTP is valid for 5 minutes.</p>
        </div>
      `
    });

    console.log("✅ OTP email sent");
  } catch (error) {
    console.error("❌ GMAIL SMTP ERROR:", error);
    throw error;
  }
};
