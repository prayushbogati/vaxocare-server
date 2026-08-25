const express = require("express");
const router = express.Router();
const {
  getBackupStatus,
  triggerBackup,
  getBackupLogs,
} = require("../controllers/backupController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All backup routes require admin authentication
router.use(protect);
router.use(adminOnly);

/**
 * @swagger
 * /api/admin/backup/status:
 *   get:
 *     summary: Get backup status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup status
 */
router.get("/status", getBackupStatus);

/**
 * @swagger
 * /api/admin/backup/trigger:
 *   post:
 *     summary: Trigger manual backup
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup triggered
 */
router.post("/trigger", triggerBackup);

/**
 * @swagger
 * /api/admin/backup/logs:
 *   get:
 *     summary: Get backup logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup logs
 */
router.get("/logs", getBackupLogs);

module.exports = router;
