const BackupLog = require("../models/BackupLog");

/**
 * Backup Controller
 * Provides backup monitoring and management for admin
 */

// In-memory backup status (in production, this would connect to actual backup service)
let backupStatus = {
  lastBackup: null,
  nextScheduledBackup: null,
  backupInProgress: false,
  lastBackupStatus: "success", // success, failed, pending
  storageUsed: 0,
  storageLimit: 10 * 1024 * 1024 * 1024, // 10 GB
};

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
exports.getBackupStatus = async (req, res) => {
  try {
    // Get recent backup logs
    const recentBackups = await BackupLog.find()
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate storage usage (simulated)
    const storageUsedPercent = (backupStatus.storageUsed / backupStatus.storageLimit) * 100;

    res.json({
      lastBackup: backupStatus.lastBackup,
      nextScheduledBackup: backupStatus.nextScheduledBackup,
      backupInProgress: backupStatus.backupInProgress,
      lastBackupStatus: backupStatus.lastBackupStatus,
      storageUsed: backupStatus.storageUsed,
      storageLimit: backupStatus.storageLimit,
      storageUsedPercent: parseFloat(storageUsedPercent.toFixed(2)),
      recentBackups,
    });
  } catch (error) {
    console.error("Get backup status error:", error);
    res.status(500).json({ message: "Error fetching backup status" });
  }
};

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
exports.triggerBackup = async (req, res) => {
  try {
    if (backupStatus.backupInProgress) {
      return res.status(400).json({ message: "Backup already in progress" });
    }

    backupStatus.backupInProgress = true;
    backupStatus.lastBackupStatus = "pending";

    // Simulate backup process
    setTimeout(async () => {
      try {
        backupStatus.lastBackup = new Date();
        backupStatus.backupInProgress = false;
        backupStatus.lastBackupStatus = "success";
        backupStatus.storageUsed = Math.floor(Math.random() * 5 * 1024 * 1024 * 1024); // Random 0-5GB

        // Log the backup
        await BackupLog.create({
          backupDate: backupStatus.lastBackup,
          status: "success",
          size: backupStatus.storageUsed,
          duration: Math.floor(Math.random() * 300), // Random 0-5 minutes
          initiatedBy: "admin",
        });

        console.log("Manual backup completed successfully");
      } catch (error) {
        backupStatus.backupInProgress = false;
        backupStatus.lastBackupStatus = "failed";
        console.error("Backup failed:", error);
      }
    }, 5000);

    res.json({ 
      message: "Backup initiated successfully",
      status: "in_progress"
    });
  } catch (error) {
    console.error("Trigger backup error:", error);
    res.status(500).json({ message: "Error triggering backup" });
  }
};

/**
 * @swagger
 * /api/admin/backup/logs:
 *   get:
 *     summary: Get backup logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Backup logs
 */
exports.getBackupLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const backups = await BackupLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await BackupLog.countDocuments();

    res.json({
      data: backups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get backup logs error:", error);
    res.status(500).json({ message: "Error fetching backup logs" });
  }
};

module.exports = exports;
