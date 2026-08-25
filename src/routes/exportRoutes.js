
const express = require("express");
const router = express.Router();
const {
  exportVaccinations,
  exportChildren,
  exportHighRisk,
  exportAuditLogs,
  generateMonthlyReport,
} = require("../controllers/exportController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Export routes - admin only

/**
 * @swagger
 * /api/export/vaccinations:
 *   get:
 *     summary: Export vaccinations data
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Exported vaccinations data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 vaccineName: "DPT 1"
 *                 scheduledDate: "2024-01-15"
 *                 status: "completed"
 *                 provider: "Dr. John Smith"
 */
router.get("/vaccinations", protect, adminOnly, exportVaccinations);

/**
 * @swagger
 * /api/export/children:
 *   get:
 *     summary: Export children data
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exported children data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Aarav Sharma"
 *                 dateOfBirth: "2023-01-01"
 *                 parentName: "Ram Sharma"
 *                 totalVaccinations: 5
 *                 completedVaccinations: 3
 */
router.get("/children", protect, adminOnly, exportChildren);

/**
 * @swagger
 * /api/export/high-risk:
 *   get:
 *     summary: Export high risk children data
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exported high risk data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Aarav Sharma"
 *                 riskScore: 0.85
 *                 riskLevel: "High"
 *                 overdueCount: 3
 *                 lastContact: "2024-01-10"
 */
router.get("/high-risk", protect, adminOnly, exportHighRisk);

/**
 * @swagger
 * /api/export/audit-logs:
 *   get:
 *     summary: Export audit logs
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Exported audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 userId: "65f1abc123abc123abc123ab"
 *                 action: "USER_LOGIN"
 *                 timestamp: "2024-01-15T10:30:00Z"
 *                 ipAddress: "192.168.1.1"
 */
router.get("/audit-logs", protect, adminOnly, exportAuditLogs);

// Report routes - admin only

/**
 * @swagger
 * /api/export/report/monthly:
 *   get:
 *     summary: Generate monthly report
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *         example: "2024-01"
 *     responses:
 *       200:
 *         description: Monthly report generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               month: "2024-01"
 *               totalChildren: 150
 *               totalVaccinations: 450
 *               completed: 380
 *               pending: 50
 *               overdue: 20
 *               completionRate: "84.44"
 */
router.get("/report/monthly", protect, adminOnly, generateMonthlyReport);

module.exports = router;

