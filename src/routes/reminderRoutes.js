
const express = require("express");
const router = express.Router();
const {
  getQueueStatus,
  getPriorityList,
  getCriticalCases,
  processReminders,
  refreshPriorityScores,
  getVaccinationPriority,
  getReminderAnalytics,
  getJobStatus,
} = require("../controllers/reminderController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

/**
 * AI-Driven Reminder Queue Routes
 *
 * All routes are protected and require admin role
 */

// All routes require admin authentication
router.use(protect, adminOnly);

/**
 * @swagger
 * /api/admin/reminders/queue:
 *   get:
 *     summary: Get AI-driven reminder queue status
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue status with statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               totalInQueue: 150
 *               processedToday: 45
 *               pending: 105
 *               critical: 12
 *               averagePriorityScore: 0.72
 */
router.get("/queue", getQueueStatus);

/**
 * @swagger
 * /api/admin/reminders/priority-list:
 *   get:
 *     summary: Get prioritized reminder list
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Prioritized list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 parentPhone: "+91-9876543210"
 *                 vaccineName: "DPT 2"
 *                 dueDate: "2024-01-15"
 *                 priorityScore: 0.95
 *                 daysOverdue: 10
 *               - _id: "65f1abc123abc123abc123ac"
 *                 childName: "Sia Sharma"
 *                 parentPhone: "+91-9876543211"
 *                 vaccineName: "Polio 3"
 *                 dueDate: "2024-01-20"
 *                 priorityScore: 0.88
 *                 daysOverdue: 5
 */
router.get("/priority-list", getPriorityList);

/**
 * @swagger
 * /api/admin/reminders/critical:
 *   get:
 *     summary: Get critical cases
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Critical cases list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 parentPhone: "+91-9876543210"
 *                 vaccineName: "DPT 1"
 *                 dueDate: "2023-12-01"
 *                 daysOverdue: 45
 *                 riskLevel: "Critical"
 *                 attempts: 3
 */
router.get("/critical", getCriticalCases);

/**
 * @swagger
 * /api/admin/reminders/process:
 *   post:
 *     summary: Process priority reminders
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxReminders:
 *                 type: integer
 *           example:
 *             maxReminders: 50
 *     responses:
 *       200:
 *         description: Processing results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               jobId: "job_65f1abc123abc123abc123ab"
 *               queued: 50
 *               processed: 45
 *               failed: 2
 *               sent: 43
 */
router.post("/process", processReminders);

/**
 * @swagger
 * /api/admin/reminders/process/{jobId}:
 *   get:
 *     summary: Get the status of a reminder processing job
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         example: "job_65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: Job status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               jobId: "job_65f1abc123abc123abc123ab"
 *               status: "completed"
 *               total: 50
 *               processed: 50
 *               sent: 48
 *               failed: 2
 *               completedAt: "2024-01-15T10:35:00Z"
 *       404:
 *         description: Job not found or expired
 */
router.get("/process/:jobId", getJobStatus);

/**
 * @swagger
 * /api/admin/reminders/refresh-scores:
 *   post:
 *     summary: Refresh priority scores
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Refresh complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               message: "Priority scores refreshed successfully"
 *               updatedCount: 150
 *               averageScore: 0.68
 */
router.post("/refresh-scores", refreshPriorityScores);

/**
 * @swagger
 * /api/admin/reminders/vaccination/{id}/priority:
 *   get:
 *     summary: Get vaccination priority
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: Priority details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               vaccinationId: "65f1abc123abc123abc123ab"
 *               childName: "Aarav Sharma"
 *               priorityScore: 0.92
 *               priorityLevel: "High"
 *               factors:
 *                 - name: "days_overdue"
 *                   value: 15
 *                   weight: 0.4
 *                 - name: "vaccine_importance"
 *                   value: "high"
 *                   weight: 0.3
 *                 - name: "child_age_risk"
 *                   value: "medium"
 *                   weight: 0.3
 */
router.get("/vaccination/:id/priority", getVaccinationPriority);

/**
 * @swagger
 * /api/admin/reminders/analytics:
 *   get:
 *     summary: Get reminder analytics
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               totalSent: 1250
 *               delivered: 1180
 *               failed: 70
 *               deliveryRate: 94.4
 *               averageResponseTime: "2.5 hours"
 *               byPriority:
 *                 high: 450
 *                 medium: 520
 *                 low: 280
 */
router.get("/analytics", getReminderAnalytics);

module.exports = router;

