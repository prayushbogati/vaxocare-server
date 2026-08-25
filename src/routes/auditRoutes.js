const express = require("express");
const router = express.Router();
const {
  getAuditLogs,
  getAuditStats,
  getAuditLogById,
} = require("../controllers/auditController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All audit routes require admin authentication
router.use(protect);
router.use(adminOnly);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of audit logs
 */
router.get("/", getAuditLogs);

/**
 * @swagger
 * /api/admin/audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit statistics
 */
router.get("/stats", getAuditStats);

/**
 * @swagger
 * /api/admin/audit-logs/:id:
 *   get:
 *     summary: Get single audit log
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log details
 */
router.get("/:id", getAuditLogById);

module.exports = router;
