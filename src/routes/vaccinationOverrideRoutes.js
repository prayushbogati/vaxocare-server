const express = require("express");
const router = express.Router();
const {
  overrideVaccination,
  approveCorrection,
  getPendingCorrections,
  bulkOverride,
} = require("../controllers/vaccinationOverrideController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All routes require admin authentication
router.use(protect);
router.use(adminOnly);

/**
 * @swagger
 * /api/admin/vaccinations/{id}/override:
 *   put:
 *     summary: Override incorrect vaccination entry
 *     tags: [Admin]
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
 *         description: Vaccination overridden
 */
router.put("/vaccinations/:id/override", overrideVaccination);

/**
 * @swagger
 * /api/admin/vaccinations/{id}/approve-correction:
 *   put:
 *     summary: Approve manual correction
 *     tags: [Admin]
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
 *         description: Correction approved
 */
router.put("/vaccinations/:id/approve-correction", approveCorrection);

/**
 * @swagger
 * /api/admin/vaccinations/pending-corrections:
 *   get:
 *     summary: Get pending corrections
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending corrections
 */
router.get("/vaccinations/pending-corrections", getPendingCorrections);

/**
 * @swagger
 * /api/admin/vaccinations/bulk-override:
 *   put:
 *     summary: Bulk override vaccination records
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk override complete
 */
router.put("/vaccinations/bulk-override", bulkOverride);

module.exports = router;
