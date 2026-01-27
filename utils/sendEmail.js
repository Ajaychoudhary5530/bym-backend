import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendOTPEmail = async (toEmail, otp) => {
  try {
    console.log("📧 Sending OTP via SendGrid to:", toEmail);

    const msg = {
      to: toEmail,
      from: process.env.EMAIL_FROM, // MUST match verified sender
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
    };

    await sgMail.send(msg);
    console.log("✅ OTP EMAIL SENT (SENDGRID)");
    return true;
  } catch (error) {
    console.error("❌ SENDGRID ERROR:", error.response?.body || error.message);
    throw error;
  }
};
