const SystemConfig = require("../models/SystemConfig");

/**
 * Email Configuration Controller
 * Allows admin to configure email settings
 */

// Default email configuration
const DEFAULT_EMAIL_CONFIG = {
  EMAIL_ENABLED: true,
  EMAIL_HOST: "smtp.gmail.com",
  EMAIL_PORT: 587,
  EMAIL_SECURE: false,
  EMAIL_USER: "",
  EMAIL_FROM_NAME: "Vaxocare",
  EMAIL_FROM_ADDRESS: "noreply@vaxocare.com",
};

/**
 * @swagger
 * /api/admin/email/config:
 *   get:
 *     summary: Get email configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email configuration
 */
exports.getEmailConfig = async (req, res) => {
  try {
    const emailConfig = await SystemConfig.find({ 
      key: { $regex: /^EMAIL_/ } 
    });

    // Convert to key-value object, mask password
    const configObj = {};
    emailConfig.forEach(c => {
      if (c.key === "EMAIL_PASS") {
        configObj[c.key] = c.value ? "********" : "";
      } else {
        configObj[c.key] = c.value;
      }
    });

    // Check if email is configured
    const isConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

    res.json({
      ...configObj,
      isConfigured,
      isEnvironmentConfigured: !!process.env.EMAIL_USER,
    });
  } catch (error) {
    console.error("Get email config error:", error);
    res.status(500).json({ message: "Error fetching email configuration" });
  }
};

/**
 * @swagger
 * /api/admin/email/config:
 *   put:
 *     summary: Update email configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               EMAIL_ENABLED:
 *                 type: boolean
 *               EMAIL_HOST:
 *                 type: string
 *               EMAIL_PORT:
 *                 type: number
 *               EMAIL_SECURE:
 *                 type: boolean
 *               EMAIL_USER:
 *                 type: string
 *               EMAIL_PASS:
 *                 type: string
 *               EMAIL_FROM_NAME:
 *                 type: string
 *               EMAIL_FROM_ADDRESS:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email configuration updated
 */
exports.updateEmailConfig = async (req, res) => {
  try {
    const {
      EMAIL_ENABLED,
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_SECURE,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_FROM_NAME,
      EMAIL_FROM_ADDRESS,
    } = req.body;

    const updates = [];

    // Update each provided field
    if (EMAIL_ENABLED !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_ENABLED" },
          { key: "EMAIL_ENABLED", value: EMAIL_ENABLED, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_HOST !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_HOST" },
          { key: "EMAIL_HOST", value: EMAIL_HOST, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_PORT !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_PORT" },
          { key: "EMAIL_PORT", value: EMAIL_PORT, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_SECURE !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_SECURE" },
          { key: "EMAIL_SECURE", value: EMAIL_SECURE, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_USER !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_USER" },
          { key: "EMAIL_USER", value: EMAIL_USER, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    // Only update password if provided and not masked
    if (EMAIL_PASS && !EMAIL_PASS.startsWith("********")) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_PASS" },
          { key: "EMAIL_PASS", value: EMAIL_PASS, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_FROM_NAME !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_FROM_NAME" },
          { key: "EMAIL_FROM_NAME", value: EMAIL_FROM_NAME, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    if (EMAIL_FROM_ADDRESS !== undefined) {
      updates.push(
        SystemConfig.findOneAndUpdate(
          { key: "EMAIL_FROM_ADDRESS" },
          { key: "EMAIL_FROM_ADDRESS", value: EMAIL_FROM_ADDRESS, updatedBy: req.user._id },
          { upsert: true, new: true }
        )
      );
    }

    await Promise.all(updates);

    res.json({ message: "Email configuration updated successfully" });
  } catch (error) {
    console.error("Update email config error:", error);
    res.status(500).json({ message: "Error updating email configuration" });
  }
};

/**
 * @swagger
 * /api/admin/email/test:
 *   post:
 *     summary: Send test email
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test email sent
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ message: "Please provide a test email address" });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({ message: "Please provide a valid email address" });
    }

    const nodemailer = require("nodemailer");

    // Get email config from system
    const emailEnabled = await SystemConfig.findOne({ key: "EMAIL_ENABLED" });
    const emailHost = await SystemConfig.findOne({ key: "EMAIL_HOST" });
    const emailPort = await SystemConfig.findOne({ key: "EMAIL_PORT" });
    const emailSecure = await SystemConfig.findOne({ key: "EMAIL_SECURE" });
    const emailUser = await SystemConfig.findOne({ key: "EMAIL_USER" });
    const emailPass = await SystemConfig.findOne({ key: "EMAIL_PASS" });

    // Check environment variables first
    const host = process.env.EMAIL_HOST || (emailHost ? emailHost.value : "smtp.gmail.com");
    const port = process.env.EMAIL_PORT || (emailPort ? parseInt(emailPort.value) : 587);
    const secure = process.env.EMAIL_SECURE === "true" || (emailSecure ? emailSecure.value : false);
    const user = process.env.EMAIL_USER || (emailUser ? emailUser.value : "");
    const pass = process.env.EMAIL_PASS || (emailPass ? emailPass.value : "");

    if (!user || !pass) {
      return res.status(400).json({ 
        message: "Email not configured. Please set EMAIL_USER and EMAIL_PASS in environment variables or update configuration." 
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"Vaxocare Test" <${user}>`,
      to: testEmail,
      subject: "Test Email - Vaxocare",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Vaxocare Email Test</h2>
          <p>This is a test email to verify your email configuration is working correctly.</p>
          <p>If you received this email, your email settings are configured properly.</p>
          <p>Regards,<br>Vaxocare System</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: `Test email sent successfully to ${testEmail}` });
  } catch (error) {
    console.error("Send test email error:", error);
    res.status(500).json({ message: "Error sending test email: " + error.message });
  }
};

module.exports = exports;
