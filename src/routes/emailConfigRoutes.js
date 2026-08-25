const express = require("express");
const router = express.Router();
const {
  getEmailConfig,
  updateEmailConfig,
  sendTestEmail,
} = require("../controllers/emailConfigController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All email config routes require admin authentication
router.use(protect);
router.use(adminOnly);

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
router.get("/config", getEmailConfig);

/**
 * @swagger
 * /api/admin/email/config:
 *   put:
 *     summary: Update email configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email configuration updated
 */
router.put("/config", updateEmailConfig);

/**
 * @swagger
 * /api/admin/email/test:
 *   post:
 *     summary: Send test email
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test email sent
 */
router.post("/test", sendTestEmail);

module.exports = router;
