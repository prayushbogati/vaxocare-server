const express = require("express");
const router = express.Router();
const {
  getVaccinationsByChild,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeVaccination,
  getRiskPrediction,
  getAvailableSlots,
  getCapacityUsage,
  getLiveStats,
} = require("../controllers/vaccinationController");
const { protect } = require("../middleware/authMiddleware");

/**
 * @swagger
 * /api/vaccinations/{childId}:
 *   get:
 *     summary: Get all vaccinations for a child
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: List of vaccinations
 */
router.get("/:childId", protect, getVaccinationsByChild);

/**
 * @swagger
 * /api/vaccinations/book/{id}:
 *   put:
 *     summary: Book appointment for vaccination
 *     tags: [Vaccinations]
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
 *               selectedDate:
 *                 type: string
 *                 example: "2024-07-10"
 *               selectedTime:
 *                 type: string
 *                 example: "10:30 AM"
 *     responses:
 *       200:
 *         description: Appointment booked
 *       400:
 *         description: Slot not available
 */
router.put("/book/:id", protect, bookAppointment);

/**
 * @swagger
 * /api/vaccinations/reschedule/{id}:
 *   put:
 *     summary: Reschedule appointment
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selectedDate:
 *                 type: string
 *               selectedTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 */
router.put("/reschedule/:id", protect, rescheduleAppointment);

/**
 * @swagger
 * /api/vaccinations/cancel/{id}:
 *   put:
 *     summary: Cancel appointment
 *     tags: [Vaccinations]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment cancelled
 */
router.put("/cancel/:id", protect, cancelAppointment);

/**
 * @swagger
 * /api/vaccinations/complete/{id}:
 *   put:
 *     summary: Mark vaccination as completed
 *     tags: [Vaccinations]
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
 *         description: Vaccination marked as completed
 */
router.put("/complete/:id", protect, completeVaccination);

/**
 * @swagger
 * /api/vaccinations/risk/{childId}:
 *   get:
 *     summary: Get AI risk prediction for a child
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: Risk prediction data
 */
router.get("/risk/:childId", protect, getRiskPrediction);

/**
 * @swagger
 * /api/vaccinations/slots/{date}:
 *   get:
 *     summary: Get available slots for a date
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         example: "2024-07-10"
 *     responses:
 *       200:
 *         description: Available time slots
 */
router.get("/slots/:date", protect, getAvailableSlots);

/**
 * @swagger
 * /api/vaccinations/capacity:
 *   get:
 *     summary: Get real-time capacity usage
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time capacity data
 */
router.get("/capacity", protect, getCapacityUsage);

/**
 * @swagger
 * /api/vaccinations/live-stats:
 *   get:
 *     summary: Get live vaccination statistics
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Live statistics
 */
router.get("/live-stats", protect, getLiveStats);

module.exports = router;
