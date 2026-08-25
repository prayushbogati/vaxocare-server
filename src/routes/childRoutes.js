const express = require("express");
const router = express.Router();
const {
  createChild,
  getChildren,
  getChildById,
  updateChild,
  deleteChild,
  getVaccinationsForReview,
  confirmVaccinations
} = require("../controllers/childController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/children:
 *   post:
 *     summary: Create a new child profile
 *     tags: [Children]
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
 *               - dateOfBirth
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Aarav Sharma"
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-01"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 example: "male"
 *               bloodGroup:
 *                 type: string
 *                 example: "A+"
 *     responses:
 *       201:
 *         description: Child created successfully
 */
router.post("/", protect, createChild);

/**
 * @swagger
 * /api/children:
 *   get:
 *     summary: Get all children for logged in parent
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of children
 */
router.get("/", protect, getChildren);

/**
 * @swagger
 * /api/children/{id}:
 *   get:
 *     summary: Get child by ID
 *     tags: [Children]
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
 *         description: Child data
 */
router.get("/:id", protect, getChildById);

/**
 * @swagger
 * /api/children/{id}:
 *   put:
 *     summary: Update child profile
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               gender:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *     responses:
 *       200:
 *         description: Child updated
 */
router.put("/:id", protect, updateChild);

/**
 * @swagger
 * /api/children/{id}/vaccinations/review:
 *   get:
 *     summary: Get missed vaccinations for review (due before registration)
 *     tags: [Children]
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
 *         description: Missed vaccinations list for review
 */
router.get("/:id/vaccinations/review", protect, getVaccinationsForReview);

/**
 * @swagger
 * /api/children/{id}/vaccinations/confirm:
 *   put:
 *     summary: Confirm which missed vaccinations were actually given
 *     tags: [Children]
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
 *             properties:
 *               notGivenVaccines:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["vaccination_id_1", "vaccination_id_2"]
 *     responses:
 *       200:
 *         description: Vaccination confirmation successful
 */
router.put("/:id/vaccinations/confirm", protect, confirmVaccinations);

/**
 * @swagger
 * /api/children/{id}:
 *   delete:
 *     summary: Delete child profile
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Child deleted
 */
router.delete("/:id", protect, deleteChild);

module.exports = router;

