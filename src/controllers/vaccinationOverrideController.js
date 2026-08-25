const Vaccination = require("../models/Vaccination");
const Child = require("../models/Child");
const AuditLog = require("../models/AuditLog");

/**
 * Admin Vaccination Override Controller
 * Handles admin overrides for vaccination records
 */

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, overdue, cancelled]
 *               completedDate:
 *                 type: string
 *                 format: date
 *               vaccineName:
 *                 type: string
 *               notes:
 *                 type: string
 *               overrideReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vaccination overridden
 */
exports.overrideVaccination = async (req, res) => {
  try {
    const { 
      status, 
      completedDate, 
      vaccineName, 
      notes, 
      overrideReason 
    } = req.body;
    
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    // Store original values for audit
    const originalValues = {
      status: vaccination.status,
      completedDate: vaccination.completedDate,
      vaccineName: vaccination.vaccineName,
      notes: vaccination.notes,
    };

    // Update fields
    if (status) vaccination.status = status;
    if (completedDate) vaccination.completedDate = new Date(completedDate);
    if (vaccineName) vaccination.vaccineName = vaccineName;
    if (notes) vaccination.notes = notes;

    await vaccination.save();

    // Update child's risk score
    await updateChildRiskScore(vaccination.childId);

    // Log the override
    await AuditLog.log({
      userId: req.user._id,
      action: "VACCINATION_OVERRIDE",
      targetType: "Vaccination",
      targetId: vaccination._id,
      description: `Vaccination record overridden: ${overrideReason || "Admin correction"}`,
      metadata: {
        originalValues,
        newValues: {
          status: vaccination.status,
          completedDate: vaccination.completedDate,
          vaccineName: vaccination.vaccineName,
          notes: vaccination.notes,
        },
        overrideReason,
      },
    });

    res.json({
      message: "Vaccination record overridden successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Override vaccination error:", error);
    res.status(500).json({ message: "Error overriding vaccination record" });
  }
};

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
 *         description: Correction approved
 */
exports.approveCorrection = async (req, res) => {
  try {
    const { notes } = req.body;
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    if (!vaccination.correctionPending) {
      return res.status(400).json({ message: "No pending correction for this record" });
    }

    // Apply the pending correction
    if (vaccination.pendingCorrection) {
      vaccination.status = vaccination.pendingCorrection.status || vaccination.status;
      vaccination.notes = vaccination.pendingCorrection.notes || vaccination.notes;
    }

    vaccination.correctionPending = false;
    vaccination.pendingCorrection = null;
    vaccination.correctionApprovedAt = new Date();
    vaccination.correctionApprovedBy = req.user._id;

    await vaccination.save();

    // Update child's risk score
    await updateChildRiskScore(vaccination.childId);

    await AuditLog.log({
      userId: req.user._id,
      action: "CORRECTION_APPROVED",
      targetType: "Vaccination",
      targetId: vaccination._id,
      description: "Manual correction approved",
      metadata: { notes },
    });

    res.json({
      message: "Correction approved successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Approve correction error:", error);
    res.status(500).json({ message: "Error approving correction" });
  }
};

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
exports.getPendingCorrections = async (req, res) => {
  try {
    const pending = await Vaccination.find({ correctionPending: true })
      .populate("childId", "name parentId")
      .populate("administeredBy", "name")
      .sort({ updatedAt: -1 });

    res.json(pending);
  } catch (error) {
    console.error("Get pending corrections error:", error);
    res.status(500).json({ message: "Error fetching pending corrections" });
  }
};

/**
 * @swagger
 * /api/admin/vaccinations/bulk-override:
 *   put:
 *     summary: Bulk override vaccination records
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vaccinationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *               overrideReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk override complete
 */
exports.bulkOverride = async (req, res) => {
  try {
    const { vaccinationIds, status, overrideReason } = req.body;

    if (!vaccinationIds || !Array.isArray(vaccinationIds)) {
      return res.status(400).json({ message: "Invalid vaccination IDs" });
    }

    const result = await Vaccination.updateMany(
      { _id: { $in: vaccinationIds } },
      { 
        status,
        $set: { [`overrideHistory.${Date.now()}`]: overrideReason || "Bulk override" },
      }
    );

    // Update risk scores for affected children
    const vaccinations = await Vaccination.find({ _id: { $in: vaccinationIds } });
    const childIds = [...new Set(vaccinations.map(v => v.childId))];
    
    for (const childId of childIds) {
      await updateChildRiskScore(childId);
    }

    await AuditLog.log({
      userId: req.user._id,
      action: "VACCINATION_OVERRIDE",
      targetType: "Vaccination",
      description: `Bulk override: ${vaccinationIds.length} records updated`,
      metadata: { vaccinationIds, status, overrideReason },
    });

    res.json({
      message: `Successfully updated ${result.modifiedCount} records`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk override error:", error);
    res.status(500).json({ message: "Error performing bulk override" });
  }
};

// Helper: Update child's risk score
const updateChildRiskScore = async (childId) => {
  try {
    const { predictRisk } = require("../ai/riskModel");
    
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

module.exports = exports;
