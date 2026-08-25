
const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getMonthlyTrends,
  getHighRiskChildren,
  getAnomalies,
  getVaccinationCoverage,
  getAllUsers,
  getUserById,
  activateUser,
  deactivateUser,
  updateUserRole,
  resetUserPassword,
  createProvider,
  getPendingProviders,
  approveProvider,
  rejectProvider,
  getAuditLogs,
  getUserStatistics,
  getAllConfigs,
  getConfigByKey,
  updateConfig,
  initializeConfigs,
  getVaccinationHeatmap,
  getRiskHeatmap,
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Dashboard & Analytics

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               totalChildren: 150
 *               totalVaccines: 750
 *               completedVaccines: 600
 *               overdueVaccines: 50
 *               completionRate: "80.00"
 */
router.get("/dashboard", protect, adminOnly, getDashboardStats);

/**
 * @swagger
 * /api/admin/trends:
 *   get:
 *     summary: Get monthly vaccination trends
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               - month: "2024-01"
 *                 total: 120
 *                 completed: 100
 *                 overdue: 20
 */
router.get("/trends", protect, adminOnly, getMonthlyTrends);

/**
 * @swagger
 * /api/admin/high-risk:
 *   get:
 *     summary: Get high risk children list
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: High risk children
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - childId: "65f1abc123abc123abc123ab"
 *                 name: "Aarav Sharma"
 *                 riskScore: 0.85
 *                 riskLevel: "High"
 */
router.get("/high-risk", protect, adminOnly, getHighRiskChildren);

/**
 * @swagger
 * /api/admin/anomalies:
 *   get:
 *     summary: Get vaccination anomalies
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Anomalies list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - id: "65f1abc123abc123abc123ab"
 *                 childId: "65f1abc123abc123abc123ab"
 *                 type: "early_vaccination"
 *                 description: "Vaccination given before minimum age"
 */
router.get("/anomalies", protect, adminOnly, getAnomalies);

/**
 * @swagger
 * /api/admin/vaccination-coverage:
 *   get:
 *     summary: Get vaccination coverage statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vaccination coverage data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               overall: 75.5
 *               byAgeGroup:
 *                 - age: "0-12 months"
 *                   coverage: 85
 *                 - age: "12-24 months"
 *                   coverage: 70
 */
router.get("/vaccination-coverage", protect, adminOnly, getVaccinationCoverage);

// User Management

/**
 * @swagger
 * /api/admin/all-users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Ram Sharma"
 *                 email: "ram@gmail.com"
 *                 role: "parent"
 *                 isActive: true
 */
router.get("/all-users", protect, adminOnly, getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Admin - Users]
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
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               _id: "65f1abc123abc123abc123ab"
 *               name: "Ram Sharma"
 *               email: "ram@gmail.com"
 *               role: "parent"
 *               isActive: true
 */
router.get("/users/:id", protect, adminOnly, getUserById);

/**
 * @swagger
 * /api/admin/users/{id}/activate:
 *   post:
 *     summary: Activate a user account
 *     tags: [Admin - Users]
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
 *         description: User activated
 */
router.post("/users/:id/activate", protect, adminOnly, activateUser);

/**
 * @swagger
 * /api/admin/users/{id}/deactivate:
 *   post:
 *     summary: Deactivate a user account
 *     tags: [Admin - Users]
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
 *         description: User deactivated
 */
router.post("/users/:id/deactivate", protect, adminOnly, deactivateUser);

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Update user role
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [parent, provider, admin]
 *             example:
 *               role: "provider"
 *     responses:
 *       200:
 *         description: Role updated
 */
router.put("/users/:id/role", protect, adminOnly, updateUserRole);

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *             example:
 *               newPassword: "newpassword123"
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/users/:id/reset-password", protect, adminOnly, resetUserPassword);

// Provider Management

/**
 * @swagger
 * /api/admin/providers:
 *   post:
 *     summary: Create a new provider
 *     tags: [Admin - Providers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *             example:
 *               name: "Dr. John Smith"
 *               email: "john@vaxocare.com"
 *               password: "provider123"
 *     responses:
 *       201:
 *         description: Provider created
 */
router.post("/providers", protect, adminOnly, createProvider);

/**
 * @swagger
 * /api/admin/providers/pending:
 *   get:
 *     summary: Get pending provider approvals
 *     tags: [Admin - Providers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending providers list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Dr. Jane Doe"
 *                 email: "jane@clinic.com"
 *                 status: "pending"
 */
router.get("/providers/pending", protect, adminOnly, getPendingProviders);

/**
 * @swagger
 * /api/admin/providers/{id}/approve:
 *   post:
 *     summary: Approve a provider
 *     tags: [Admin - Providers]
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
 *         description: Provider approved
 */
router.post("/providers/:id/approve", protect, adminOnly, approveProvider);

/**
 * @swagger
 * /api/admin/providers/{id}/reject:
 *   post:
 *     summary: Reject a provider
 *     tags: [Admin - Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *           example:
 *             reason: "Missing required medical credentials"
 *     responses:
 *       200:
 *         description: Provider rejected
 */
router.post("/providers/:id/reject", protect, adminOnly, rejectProvider);

// Audit & Statistics

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin - Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: Audit logs list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               logs:
 *                 - _id: "65f1abc123abc123abc123ab"
 *                   userId: "65f1abc123abc123abc123ab"
 *                   action: "USER_LOGIN"
 *                   timestamp: "2024-01-15T10:30:00Z"
 */
router.get("/audit-logs", protect, adminOnly, getAuditLogs);

/**
 * @swagger
 * /api/admin/statistics/users:
 *   get:
 *     summary: Get user statistics
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               totalUsers: 200
 *               parents: 150
 *               providers: 40
 *               admins: 10
 */
router.get("/statistics/users", protect, adminOnly, getUserStatistics);

// System Configuration

/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     summary: Get all system configurations
 *     tags: [Admin - Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               MAX_CHILDREN_PER_PROVIDER: 50
 *               REMINDER_DAYS_BEFORE: 3
 *               WORKING_HOURS_START: "09:00"
 */
router.get("/config", protect, adminOnly, getAllConfigs);

/**
 * @swagger
 * /api/admin/config/{key}:
 *   get:
 *     summary: Get configuration by key
 *     tags: [Admin - Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: "MAX_CHILDREN_PER_PROVIDER"
 *     responses:
 *       200:
 *         description: Configuration value
 */
router.get("/config/:key", protect, adminOnly, getConfigByKey);

/**
 * @swagger
 * /api/admin/config/{key}:
 *   put:
 *     summary: Update configuration
 *     tags: [Admin - Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         example: "MAX_CHILDREN_PER_PROVIDER"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 *           example:
 *             value: "75"
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.put("/config/:key", protect, adminOnly, updateConfig);

/**
 * @swagger
 * /api/admin/config/initialize:
 *   post:
 *     summary: Initialize default configurations
 *     tags: [Admin - Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations initialized
 */
router.post("/config/initialize", protect, adminOnly, initializeConfigs);

// Heatmap Data

/**
 * @swagger
 * /api/admin/heatmap:
 *   get:
 *     summary: Get vaccination heatmap data
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Heatmap data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               - date: "2024-01"
 *                 count: 150
 *                 region: "North"
 */
router.get("/heatmap", protect, adminOnly, getVaccinationHeatmap);

/**
 * @swagger
 * /api/admin/risk-heatmap:
 *   get:
 *     summary: Get risk heatmap data
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Risk heatmap data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               - region: "North"
 *                 highRisk: 15
 *                 mediumRisk: 25
 *                 lowRisk: 60
 */
router.get("/risk-heatmap", protect, adminOnly, getRiskHeatmap);

module.exports = router;

