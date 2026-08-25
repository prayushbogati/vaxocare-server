
const express = require("express");
const router = express.Router();
const {
  getAllConfig,
  getConfig,
  updateConfig,
  resetConfig,
} = require("../controllers/systemConfigController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All config routes require admin authentication
router.use(protect);
router.use(adminOnly);

/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     summary: Get all system configurations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               MAX_CHILDREN_PER_PROVIDER: 50
 *               REMINDER_DAYS_BEFORE: 3
 *               WORKING_HOURS_START: "09:00"
 *               WORKING_HOURS_END: "17:00"
 *               APPOINTMENT_DURATION_MINUTES: 30
 *               MAX_DAILY_APPOINTMENTS: 20
 */
router.get("/", getAllConfig);

/**
 * @swagger
 * /api/admin/config/reset:
 *   post:
 *     summary: Reset all configurations to default
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               message: "All configurations reset to default"
 */
router.post("/reset", resetConfig);

/**
 * @swagger
 * /api/admin/config/{key}:
 *   get:
 *     summary: Get specific configuration
 *     tags: [Admin]
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
 *         description: Configuration details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               key: "MAX_CHILDREN_PER_PROVIDER"
 *               value: 50
 *               type: "number"
 */
router.get("/:key", getConfig);

/**
 * @swagger
 * /api/admin/config/{key}:
 *   put:
 *     summary: Update system configuration
 *     tags: [Admin]
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
 *                 type: mixed
 *           example:
 *             value: 75
 *     responses:
 *       200:
 *         description: Configuration updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               message: "Configuration updated successfully"
 *               key: "MAX_CHILDREN_PER_PROVIDER"
 *               value: 75
 */
router.put("/:key", updateConfig);

module.exports = router;

