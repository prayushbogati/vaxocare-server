
const express = require("express");
const router = express.Router();
const {
  getAssignedChildren,
  getChildDetails,
  getChildVaccinations,
  completeVaccination,
  correctRecord,
  getTodayAppointments,
  approveAppointment,
  rejectAppointment,
  rescheduleAppointment,
  getDailySummary,
  getOverdueList,
  getUpcomingVaccinations,
  getChildRiskPrediction,
} = require("../controllers/providerController");
const { protect, providerOrAdmin } = require("../middleware/authMiddleware");

// All provider routes require authentication
router.use(protect);
router.use(providerOrAdmin);

/**
 * Children management
 */

/**
 * @swagger
 * /api/provider/children:
 *   get:
 *     summary: Get all assigned children
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned children
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Aarav Sharma"
 *                 dateOfBirth: "2023-01-01"
 *                 parentName: "Ram Sharma"
 *                 status: "active"
 */
router.get("/children", getAssignedChildren);

/**
 * @swagger
 * /api/provider/children/{id}:
 *   get:
 *     summary: Get child details by ID
 *     tags: [Provider]
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
 *         description: Child details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               _id: "65f1abc123abc123abc123ab"
 *               name: "Aarav Sharma"
 *               dateOfBirth: "2023-01-01"
 *               gender: "male"
 *               bloodGroup: "A+"
 *               parentName: "Ram Sharma"
 *               parentPhone: "+91-9876543210"
 */
router.get("/children/:id", getChildDetails);

/**
 * @swagger
 * /api/provider/children/{id}/vaccinations:
 *   get:
 *     summary: Get vaccinations for a child
 *     tags: [Provider]
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
 *         description: Vaccination records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 vaccineName: "DPT 1"
 *                 dueDate: "2023-03-01"
 *                 scheduledDate: "2023-03-05"
 *                 status: "completed"
 */
router.get("/children/:id/vaccinations", getChildVaccinations);

/**
 * @swagger
 * /api/provider/children/{id}/risk:
 *   get:
 *     summary: Get risk prediction for a child
 *     tags: [Provider]
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
 *         description: Risk prediction data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               childId: "65f1abc123abc123abc123ab"
 *               riskProbability: 0.75
 *               riskLevel: "High"
 *               factors: ["overdue_vaccinations", "missed_appointments"]
 */
router.get("/children/:id/risk", getChildRiskPrediction);

/**
 * Vaccination management
 */

/**
 * @swagger
 * /api/provider/vaccinations/{id}/complete:
 *   put:
 *     summary: Mark vaccination as completed
 *     tags: [Provider]
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
 *               notes:
 *                 type: string
 *               batchNumber:
 *                 type: string
 *           example:
 *             notes: "Vaccination administered successfully"
 *             batchNumber: "DPT-2024-001"
 *     responses:
 *       200:
 *         description: Vaccination completed
 */
router.put("/vaccinations/:id/complete", completeVaccination);

/**
 * @swagger
 * /api/provider/vaccinations/{id}/correct:
 *   put:
 *     summary: Correct a vaccination record
 *     tags: [Provider]
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
 *               vaccineName:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, completed, overdue]
 *           example:
 *             vaccineName: "DPT 2"
 *             scheduledDate: "2023-04-15"
 *             status: "completed"
 *     responses:
 *       200:
 *         description: Record corrected
 */
router.put("/vaccinations/:id/correct", correctRecord);

/**
 * Appointment management
 */

/**
 * @swagger
 * /api/provider/appointments/today:
 *   get:
 *     summary: Get today's appointments
 *     tags: [Provider - Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 appointmentTime: "10:30 AM"
 *                 vaccineName: "DPT 1"
 *                 status: "confirmed"
 */
router.get("/appointments/today", getTodayAppointments);

/**
 * @swagger
 * /api/provider/appointments/{id}/approve:
 *   put:
 *     summary: Approve an appointment
 *     tags: [Provider - Appointments]
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
 *         description: Appointment approved
 */
router.put("/appointments/:id/approve", approveAppointment);

/**
 * @swagger
 * /api/provider/appointments/{id}/reject:
 *   put:
 *     summary: Reject an appointment
 *     tags: [Provider - Appointments]
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
 *             reason: "Doctor unavailable on requested date"
 *     responses:
 *       200:
 *         description: Appointment rejected
 */
router.put("/appointments/:id/reject", rejectAppointment);

/**
 * @swagger
 * /api/provider/appointments/{id}/reschedule:
 *   put:
 *     summary: Reschedule an appointment
 *     tags: [Provider - Appointments]
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
 *               newDate:
 *                 type: string
 *                 format: date
 *               newTime:
 *                 type: string
 *           example:
 *             newDate: "2024-02-20"
 *             newTime: "02:30 PM"
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 */
router.put("/appointments/:id/reschedule", rescheduleAppointment);

/**
 * Reporting
 */

/**
 * @swagger
 * /api/provider/daily-summary:
 *   get:
 *     summary: Get daily summary report
 *     tags: [Provider - Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               date: "2024-01-15"
 *               totalAppointments: 20
 *               completed: 15
 *               cancelled: 2
 *               rescheduled: 3
 */
router.get("/daily-summary", getDailySummary);

/**
 * @swagger
 * /api/provider/overdue:
 *   get:
 *     summary: Get overdue vaccinations list
 *     tags: [Provider - Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue vaccinations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 vaccineName: "DPT 2"
 *                 dueDate: "2023-12-01"
 *                 daysOverdue: 45
 */
router.get("/overdue", getOverdueList);

/**
 * @swagger
 * /api/provider/upcoming:
 *   get:
 *     summary: Get upcoming vaccinations
 *     tags: [Provider - Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming vaccinations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 childName: "Aarav Sharma"
 *                 vaccineName: "DPT 3"
 *                 dueDate: "2024-02-15"
 *                 scheduledDate: "2024-02-20"
 */
router.get("/upcoming", getUpcomingVaccinations);

module.exports = router;

