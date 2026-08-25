const nodemailer = require("nodemailer");

// Create transporter function - only when needed
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send vaccination reminder email
 * @param {string} to - Recipient email
 * @param {string} childName - Child's name
 * @param {string} vaccineName - Vaccine name
 * @param {string} dueDate - Due date string
 */
const sendReminderEmail = async (to, childName, vaccineName, dueDate) => {
  try {
    // Skip if no email configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("Email not configured. Skipping reminder.");
      console.log(`Reminder: ${childName} needs ${vaccineName} by ${dueDate}`);
      return { success: false, message: "Email not configured" };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, message: "Email not configured" };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `Vaccination Reminder - ${vaccineName} for ${childName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Vaxocare Vaccination Reminder</h2>
          <p>Dear Parent,</p>
          <p>This is a reminder that your child <strong>${childName}</strong> has an upcoming vaccination:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 8px 0;"><strong>Vaccine:</strong> ${vaccineName}</p>
            <p style="margin: 8px 0;"><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <p>Please schedule an appointment at your nearest vaccination center.</p>
          <p>Regards,<br>Vaxocare Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Reminder email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to new users
 */
const sendWelcomeEmail = async (to, name) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("Email not configured. Skipping welcome email.");
      return { success: false, message: "Email not configured" };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, message: "Email not configured" };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Welcome to Vaxocare",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Vaxocare!</h2>
          <p>Dear ${name},</p>
          <p>Thank you for registering with Vaxocare - Smart Vaccination Management System.</p>
          <p>You can now:</p>
          <ul>
            <li>Register your            <li>Track their vaccination schedules</li>
            children</li>
 <li>Book appointments</li>
            <li>Receive automatic reminders</li>
          </ul>
          <p>Get started by logging in and adding your child's profile.</p>
          <p>Regards,<br>Vaxocare Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetUrl) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("Email not configured. Skipping password reset email.");
      return { success: false, message: "Email not configured" };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, message: "Email not configured" };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Password Reset Request - Vaxocare",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Dear ${name},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          </div>
          <p>This link will expire in 15 minutes.</p>
          <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
          <p>Regards,<br>Vaxocare Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendReminderEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
