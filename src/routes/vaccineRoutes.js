const express = require("express");
const router = express.Router();
const {
  createVaccine,
  getAllVaccines,
  getVaccineById,
  updateVaccine,
  deleteVaccine,
  seedVaccines,
} = require("../controllers/vaccineController");
const { protect, providerOrAdmin } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/vaccines:
 *   post:
 *     summary: Create a new vaccine
 *     tags: [Vaccines]
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
 *               - code
 *               - weeksAfterBirth
 *             properties:
 *               name:
 *                 type: string
 *                 example: "DPT 1"
 *               code:
 *                 type: string
 *                 example: "DPT-1"
 *               description:
 *                 type: string
 *               weeksAfterBirth:
 *                 type: number
 *               dosesRequired:
 *                 type: number
 *               doseIntervalWeeks:
 *                 type: number
 *               isCritical:
 *                 type: boolean
 *               applicableGenders:
 *                 type: string
 *               minimumAgeWeeks:
 *                 type: number
 *               maximumAgeWeeks:
 *                 type: number
 *               sideEffects:
 *                 type: string
 *               precautions:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vaccine created successfully
 *       400:
 *         description: Validation error
 */
router.post("/", protect, providerOrAdmin, createVaccine);

/**
 * @swagger
 * /api/vaccines:
 *   get:
 *     summary: Get all vaccines
 *     tags: [Vaccines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vaccines
 */
router.get("/", protect, getAllVaccines);

/**
 * @swagger
 * /api/vaccines/seed:
 *   post:
 *     summary: Seed default vaccines
 *     tags: [Vaccines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Vaccines seeded
 */
router.post("/seed", protect, providerOrAdmin, seedVaccines);

/**
 * @swagger
 * /api/vaccines/{id}:
 *   get:
 *     summary: Get vaccine by ID
 *     tags: [Vaccines]
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
 *         description: Vaccine data
 *       404:
 *         description: Vaccine not found
 */
router.get("/:id", protect, getVaccineById);

/**
 * @swagger
 * /api/vaccines/{id}:
 *   put:
 *     summary: Update vaccine
 *     tags: [Vaccines]
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
 *         description: Vaccine updated
 *       404:
 *         description: Vaccine not found
 */
router.put("/:id", protect, providerOrAdmin, updateVaccine);

/**
 * @swagger
 * /api/vaccines/{id}:
 *   delete:
 *     summary: Delete vaccine
 *     tags: [Vaccines]
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
 *         description: Vaccine deleted
 *       404:
 *         description: Vaccine not found
 */
router.delete("/:id", protect, providerOrAdmin, deleteVaccine);

module.exports = router;
