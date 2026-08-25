const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

const {
  getAllChildrenRisk,
  getHighRiskChildren,
  getMediumRiskChildren,
  getLowRiskChildren,
  getAIDashboardStats,
  getChildRiskAnalysis
} = require("../controllers/aiAdminController");

const {
  getModelConfig,
  getModelHistory,
  trainModel,
  updateWeights,
  rollbackModel,
  testPrediction
} = require("../controllers/aiModelController");

/**
 * AI Admin Routes
 * 
 * All routes are protected and require admin role
 */

/**
 * @swagger
 * /api/admin/ai/all-risk:
 *   get:
 *     summary: Get all children with AI risk scores
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All children with risk scores
 */
router.get("/all-risk", protect, adminOnly, getAllChildrenRisk);

/**
 * @swagger
 * /api/admin/ai/high-risk:
 *   get:
 *     summary: Get only high risk children
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 */
router.get("/high-risk", protect, adminOnly, getHighRiskChildren);

/**
 * @swagger
 * /api/admin/ai/medium-risk:
 *   get:
 *     summary: Get medium risk children
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 */
router.get("/medium-risk", protect, adminOnly, getMediumRiskChildren);

/**
 * @swagger
 * /api/admin/ai/low-risk:
 *   get:
 *     summary: Get low risk children
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 */
router.get("/low-risk", protect, adminOnly, getLowRiskChildren);

/**
 * @swagger
 * /api/admin/ai/stats:
 *   get:
 *     summary: Get AI dashboard statistics
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", protect, adminOnly, getAIDashboardStats);

/**
 * @swagger
 * /api/admin/ai/risk/{childId}:
 *   get:
 *     summary: Get specific child's risk analysis
 *     tags: [Admin - AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/risk/:childId", protect, adminOnly, getChildRiskAnalysis);

/**
 * ============================================================================
 * MODEL MANAGEMENT ROUTES (NEW)
 * ============================================================================
 */

/**
 * @swagger
 * /api/admin/ai/model/config:
 *   get:
 *     summary: Get current model configuration
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current model weights and configuration
 */
router.get("/model/config", protect, adminOnly, getModelConfig);

/**
 * @swagger
 * /api/admin/ai/model/history:
 *   get:
 *     summary: Get model version history
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 */
router.get("/model/history", protect, adminOnly, getModelHistory);

/**
 * @swagger
 * /api/admin/ai/model/train:
 *   post:
 *     summary: Train model and save to database
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               iterations:
 *                 type: number
 *                 default: 1000
 *               learningRate:
 *                 type: number
 *                 default: 0.01
 */
router.post("/model/train", protect, adminOnly, trainModel);

/**
 * @swagger
 * /api/admin/ai/model/weights:
 *   put:
 *     summary: Update model weights manually
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weights:
 *                 type: object
 *                 required: [w1, w2, w3, w4, bias]
 */
router.put("/model/weights", protect, adminOnly, updateWeights);

/**
 * @swagger
 * /api/admin/ai/model/rollback/{version}:
 *   post:
 *     summary: Rollback to a specific model version
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *         example: "v1"
 */
router.post("/model/rollback/:version", protect, adminOnly, rollbackModel);

/**
 * @swagger
 * /api/admin/ai/model/test:
 *   post:
 *     summary: Test prediction with current model
 *     tags: [Admin - AI Model]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               overdueCount:
 *                 type: number
 *               missedAppointments:
 *                 type: number
 *               daysSinceLast:
 *                 type: number
 *               completionRate:
 *                 type: number
 */
router.post("/model/test", protect, adminOnly, testPrediction);

module.exports = router;

