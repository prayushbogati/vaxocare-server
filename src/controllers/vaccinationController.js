const Vaccination = require("../models/Vaccination");
const Child = require("../models/Child");
const { predictRisk, detectAnomaly } = require("../ai/riskModel");

// Default daily capacity for appointments
const DAILY_CAPACITY = 10;
const AVAILABLE_HOURS = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];

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
exports.getVaccinationsByChild = async (req, res) => {
  try {
    const { childId } = req.params;

    // Verify child exists and user has access
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check authorization
    if (
      child.parentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "provider"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const vaccinations = await Vaccination.find({ childId }).sort({ dueDate: 1 });

    res.json(vaccinations);
  } catch (error) {
    console.error("Get vaccinations error:", error);
    res.status(500).json({ message: "Error fetching vaccinations" });
  }
};

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
exports.bookAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedDate, selectedTime } = req.body;

    if (!selectedDate || !selectedTime) {
      return res.status(400).json({ message: "Please provide date and time" });
    }

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    if (vaccination.status === "completed") {
      return res.status(400).json({ message: "Vaccination already completed" });
    }

    const child = await Child.findById(vaccination.childId);
    if (!child) {
      return res.status(404).json({ message: "Child record not found" });
    }

    // Only parents may book appointments for their own child.
    if (req.user.role === "parent" && child.parentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // If the parent has a selected provider, ensure the child is assigned to that provider
    // so the appointment request is routed to the selected provider for approval.
    const selectedProviderId = req.user.selectedProviderId || null;
    if (req.user.role === "parent" && selectedProviderId) {
      if (!child.assignedProviderId || child.assignedProviderId.toString() !== selectedProviderId.toString()) {
        child.assignedProviderId = selectedProviderId;
        await child.save();
      }
    }

    // Check slot availability (Greedy Slot Allocation Algorithm)
    const bookedCount = await Vaccination.countDocuments({
      scheduledDate: selectedDate,
      appointmentTime: selectedTime,
      _id: { $ne: id }, // Exclude current record
    });

    if (bookedCount >= DAILY_CAPACITY) {
      return res.status(400).json({
        message: "Selected time slot is full. Please choose another time.",
        availableHours: AVAILABLE_HOURS,
      });
    }

    // Update vaccination with appointment
    vaccination.scheduledDate = selectedDate;
    vaccination.appointmentTime = selectedTime;
    vaccination.status = "pending";
    vaccination.approvalStatus = "pending";
    await vaccination.save();

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.emit("appointmentBooked", {
        childId: vaccination.childId,
        vaccineName: vaccination.vaccineName,
        date: selectedDate,
        time: selectedTime,
      });

      // Emit capacity update
      const todayAppointments = await Vaccination.countDocuments({
        scheduledDate: selectedDate,
        status: { $in: ["pending", "scheduled"] },
      });
      const totalCapacity = AVAILABLE_HOURS.length * DAILY_CAPACITY;

      io.emit("capacityUpdate", {
        date: selectedDate,
        booked: todayAppointments,
        available: totalCapacity - todayAppointments,
        percentage: Math.round((todayAppointments / totalCapacity) * 100),
        timestamp: new Date(),
      });
    }

    res.json({
      message: "Appointment booked successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Book appointment error:", error);
    res.status(500).json({ message: "Error booking appointment" });
  }
};

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
 *                 example: "2024-07-15"
 *               selectedTime:
 *                 type: string
 *                 example: "11:00 AM"
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 *       400:
 *         description: Slot not available
 */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedDate, selectedTime } = req.body;

    if (!selectedDate || !selectedTime) {
      return res.status(400).json({ message: "Please provide date and time" });
    }

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    // Verify ownership for parent users
    const child = await Child.findById(vaccination.childId);
    if (child.parentId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (vaccination.status === "completed") {
      return res.status(400).json({ message: "Cannot reschedule completed vaccination" });
    }

    // Check slot availability
    const bookedCount = await Vaccination.countDocuments({
      scheduledDate: selectedDate,
      appointmentTime: selectedTime,
      _id: { $ne: id },
    });

    if (bookedCount >= DAILY_CAPACITY) {
      return res.status(400).json({
        message: "Selected time slot is full. Please choose another time.",
        availableHours: AVAILABLE_HOURS,
      });
    }

    // Update appointment
    vaccination.scheduledDate = selectedDate;
    vaccination.appointmentTime = selectedTime;
    vaccination.status = "pending"; // Reset to pending after reschedule
    await vaccination.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("appointmentRescheduled", {
        childId: vaccination.childId,
        vaccineName: vaccination.vaccineName,
        newDate: selectedDate,
        newTime: selectedTime,
      });
    }

    res.json({
      message: "Appointment rescheduled successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Reschedule appointment error:", error);
    res.status(500).json({ message: "Error rescheduling appointment" });
  }
};

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
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    // Verify ownership for parent users
    const child = await Child.findById(vaccination.childId);
    if (child.parentId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (vaccination.status === "completed") {
      return res.status(400).json({ message: "Cannot cancel completed vaccination" });
    }

    // Update status to cancelled
    vaccination.status = "cancelled";
    vaccination.notes = reason ? `Cancelled: ${reason}` : "Cancelled by user";
    vaccination.scheduledDate = null;
    vaccination.appointmentTime = null;
    await vaccination.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("appointmentCancelled", {
        childId: vaccination.childId,
        vaccineName: vaccination.vaccineName,
      });
    }

    res.json({
      message: "Appointment cancelled successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);
    res.status(500).json({ message: "Error cancelling appointment" });
  }
};

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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vaccination marked as completed
 */
exports.completeVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const vaccination = await Vaccination.findById(id);
    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    const today = new Date();
    const completedDate = today;

    // Anomaly Detection
    let anomalyFlag = false;
    let anomalyReason = "";

    // Check if completed before due date
    if (completedDate < vaccination.dueDate) {
      anomalyFlag = true;
      anomalyReason = "Vaccination given before due date";
    }

    // Check minimum interval from previous vaccination
    const previousVaccination = await Vaccination.findOne({
      childId: vaccination.childId,
      completedDate: { $exists: true },
    }).sort({ completedDate: -1 });

    if (previousVaccination && previousVaccination.completedDate) {
      const daysBetween = Math.floor(
        (completedDate - previousVaccination.completedDate) / (1000 * 60 * 60 * 24)
      );
      if (daysBetween < 28) {
        anomalyFlag = true;
        anomalyReason = anomalyReason
          ? anomalyReason + "; Minimum interval violation"
          : "Minimum interval violation (less than 28 days)";
      }
    }

    // Update vaccination
    vaccination.status = "completed";
    vaccination.completedDate = completedDate;
    vaccination.anomalyFlag = anomalyFlag;
    vaccination.anomalyReason = anomalyReason;
    vaccination.notes = notes || "";
    vaccination.administeredBy = req.user._id;
    await vaccination.save();

    // Update child's risk score
    await updateChildRiskScore(vaccination.childId);

    // Emit capacity update via Socket.io
    const io = req.app.get("io");
    if (io) {
      // Get updated capacity
      const dateStr = completedDate.toISOString().split('T')[0];
      const todayAppointments = await Vaccination.countDocuments({
        scheduledDate: dateStr,
        status: { $in: ["pending", "scheduled"] },
      });
      const totalCapacity = AVAILABLE_HOURS.length * DAILY_CAPACITY;

      io.emit("capacityUpdate", {
        date: dateStr,
        booked: todayAppointments,
        available: totalCapacity - todayAppointments,
        percentage: Math.round((todayAppointments / totalCapacity) * 100),
        timestamp: new Date(),
      });

      io.emit("vaccinationCompleted", {
        childId: vaccination.childId,
        vaccineName: vaccination.vaccineName,
        completedAt: completedDate,
      });
    }

    res.json({
      message: "Vaccination marked as completed",
      data: vaccination,
    });
  } catch (error) {
    console.error("Complete vaccination error:", error);
    res.status(500).json({ message: "Error completing vaccination" });
  }
};

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
 *     responses:
 *       200:
 *         description: Risk prediction data
 */
exports.getRiskPrediction = async (req, res) => {
  try {
    const { childId } = req.params;

    // Verify access
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Get vaccination statistics
    const totalVaccines = await Vaccination.countDocuments({ childId });
    const overdueVaccines = await Vaccination.countDocuments({
      childId,
      status: "overdue",
    });
    const completedVaccines = await Vaccination.countDocuments({
      childId,
      status: "completed",
    });

    // Get last vaccination date
    const lastVaccination = await Vaccination.findOne({
      childId,
      status: "completed",
    }).sort({ completedDate: -1 });

    const daysSinceLast = lastVaccination?.completedDate
      ? Math.floor((new Date() - lastVaccination.completedDate) / (1000 * 60 * 60 * 24))
      : 0;

    // Get AI prediction
    const riskResult = await predictRisk({
      overdueCount: overdueVaccines,
      missedAppointments: overdueVaccines,
      daysSinceLastVaccination: daysSinceLast,
      previousRiskScore: child.riskScore || 0,
      totalVaccines,
      completedVaccines,
    });

    res.json({
      childId,
      riskProbability: riskResult.probability,
      riskLevel: riskResult.riskLevel,
      recommendations: riskResult.recommendations,
      factors: riskResult.factors,
    });
  } catch (error) {
    console.error("Get risk prediction error:", error);
    res.status(500).json({ message: "Error getting risk prediction" });
  }
};

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
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.params;

    const bookedSlots = await Vaccination.distinct("appointmentTime", {
      scheduledDate: date,
      status: { $ne: "completed" },
    });

    const availableSlots = AVAILABLE_HOURS.filter((slot) => !bookedSlots.includes(slot));

    res.json({
      date,
      totalSlots: AVAILABLE_HOURS.length,
      bookedSlots: bookedSlots.length,
      availableSlots,
    });
  } catch (error) {
    console.error("Get slots error:", error);
    res.status(500).json({ message: "Error getting available slots" });
  }
};

// Helper: Update child's risk score
const updateChildRiskScore = async (childId) => {
  try {
    const totalVaccines = await Vaccination.countDocuments({ childId });
    const overdueVaccines = await Vaccination.countDocuments({
      childId,
      status: "overdue",
    });
    const completedVaccines = await Vaccination.countDocuments({
      childId,
      status: "completed",
    });

    const riskResult = await predictRisk({
      overdueCount: overdueVaccines,
      missedAppointments: overdueVaccines,
      totalVaccines,
      completedVaccines,
    });

    await Child.findByIdAndUpdate(childId, {
      riskScore: Math.round(riskResult.probability * 100),
    });
  } catch (error) {
    console.error("Error updating risk score:", error);
  }
};

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
exports.getCapacityUsage = async (req, res) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Get today's appointments
    const todayAppointments = await Vaccination.find({
      scheduledDate: dateStr,
      status: { $in: ["pending", "scheduled"] },
    }).populate("childId", "name");

    // Calculate capacity per hour
    const hourlyCapacity = {};
    for (const hour of AVAILABLE_HOURS) {
      const count = todayAppointments.filter(
        (apt) => apt.appointmentTime === hour
      ).length;
      hourlyCapacity[hour] = {
        booked: count,
        available: DAILY_CAPACITY - count,
        percentage: Math.round((count / DAILY_CAPACITY) * 100),
      };
    }

    const totalBooked = todayAppointments.length;
    const totalCapacity = AVAILABLE_HOURS.length * DAILY_CAPACITY;

    res.json({
      date: dateStr,
      daily: {
        totalBooked,
        totalCapacity,
        available: totalCapacity - totalBooked,
        percentage: Math.round((totalBooked / totalCapacity) * 100),
      },
      hourly: hourlyCapacity,
      slots: AVAILABLE_HOURS.length,
    });
  } catch (error) {
    console.error("Get capacity error:", error);
    res.status(500).json({ message: "Error getting capacity data" });
  }
};

/**
 * @swagger
 * /api/vaccinations/live-stats:
 *   get:
 *     summary: Get live vaccination statistics (for real-time dashboard)
 *     tags: [Vaccinations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Live statistics
 */
exports.getLiveStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's appointments
    const todayStats = await Vaccination.aggregate([
      {
        $match: {
          scheduledDate: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Overall stats
    const overallStats = await Vaccination.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert arrays to objects
    const todayByStatus = {};
    todayStats.forEach((stat) => {
      todayByStatus[stat._id] = stat.count;
    });

    const overallByStatus = {};
    overallStats.forEach((stat) => {
      overallByStatus[stat._id] = stat.count;
    });

    // Get high-risk children count
    const highRiskCount = await Child.countDocuments({
      riskScore: { $gte: 50 },
      isActive: true,
    });

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("liveStats", {
        today: todayByStatus,
        overall: overallByStatus,
        highRiskCount,
        timestamp: new Date(),
      });
    }

    res.json({
      today: todayByStatus,
      overall: overallByStatus,
      highRiskCount,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Get live stats error:", error);
    res.status(500).json({ message: "Error getting live stats" });
  }
};

module.exports = exports;
