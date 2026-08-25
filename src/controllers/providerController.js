const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");
const User = require("../models/User");
const { predictRisk } = require("../ai/riskModel");

/**
 * Provider Controller
 * Extended provider functionality
 */

/**
 * @swagger
 * /api/provider/children:
 *   get:
 *     summary: Get assigned children
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned children
 */
/**
 * Scope provider-related queries based on who is calling.
 *
 * - Provider dashboard calls this controller with req.user.role === "provider"
 *   => providerId is the authenticated provider's user id.
 *
 * - Parent portal (default provider / Jane Doe selection) may call these endpoints
 *   while authenticated as req.user.role === "parent".
 *   => providerId should come from req.user.selectedProviderId (stored by provider-selection endpoints).
 */
const getScopedProviderId = (req) => {
  if (!req.user) return null;

  // Provider user calling the provider dashboard
  if (req.user.role === "provider") {
    return req.user.id ? req.user.id : req.user._id ? req.user._id : null;
  }

  // Parent calling provider dashboard for a selected/default provider
  if (req.user.role === "parent") {
    // selectedProviderId is stored on the parent user document (if provider was chosen)
    if (req.user.selectedProviderId) return req.user.selectedProviderId;

    // If no provider is selected, default to a provider named "Jane Doe"
    // so provider dashboard sections show assigned children/appointments by default.
    return (async () => {
      try {
        const provider = await User.findOne({ role: "provider", name: "Jane Doe", isApproved: true, isActive: true })
          .select("_id")
          .lean();
        return provider?._id || null;
      } catch (e) {
        return null;
      }
    })();
  }

  return null;
};

/**
 * Provider portal fallback strategy:
 * Primary: Child.assignedProviderId === providerId
 * Fallback: Parent (User) has selectedProviderId === providerId (covers old/migrated records
 * where assignedProviderId wasn't written to Child).
 */
const getProviderChildFilter = async (providerId) => {
  const providerIdStr = String(providerId);

  // 1) primary match by assignedProviderId
  const primaryFilter = { assignedProviderId: providerId, isActive: true };

  // 2) fallback: find parentIds that selected this provider
  const parentIds = await User.find(
    { role: "parent", selectedProviderId: providerId, isActive: true },
    { _id: 1 }
  ).lean();

  const fallbackParentIds = parentIds.map((p) => p._id).filter(Boolean);

  if (!fallbackParentIds.length) return primaryFilter;

  // Use $or: either directly assignedProviderId matches, OR parent's selectedProviderId matches.
  return {
    isActive: true,
    $or: [
      { assignedProviderId: providerId },
      { parentId: { $in: fallbackParentIds } },
    ],
  };
};

exports.getAssignedChildren = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const query = await getProviderChildFilter(providerId);

    const children = await Child.find(query)
      .populate("parentId", "name email phone")
      .sort({ createdAt: -1 });


    // Get vaccination stats for each child
    const childrenWithStats = await Promise.all(
      children.map(async (child) => {
        const totalVaccines = await Vaccination.countDocuments({ childId: child._id });
        const completedVaccines = await Vaccination.countDocuments({
          childId: child._id,
          status: "completed"
        });
        const overdueVaccines = await Vaccination.countDocuments({
          childId: child._id,
          status: "overdue"
        });

        return {
          ...child.toObject(),
          stats: {
            totalVaccines,
            completedVaccines,
            overdueVaccines,
            completionRate: totalVaccines > 0
              ? ((completedVaccines / totalVaccines) * 100).toFixed(1)
              : 0,
          },
        };
      })
    );

    res.json(childrenWithStats);
  } catch (error) {
    console.error("Get assigned children error:", error);
    res.status(500).json({ message: "Error fetching assigned children" });
  }
};

/**
 * @swagger
 * /api/provider/children/{id}:
 *   get:
 *     summary: Get child details
 *     tags: [Provider]
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
 *         description: Child details
 */
exports.getChildDetails = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: req.params.id,
      ...queryBase,
    }).populate("parentId", "name email phone address");

    if (!child) {
      return res.status(404).json({ message: "Child not found or not assigned to you" });
    }


    // Get vaccination history
    const vaccinations = await Vaccination.find({ childId: child._id })
      .sort({ dueDate: -1 });

    // Calculate risk history
    const riskHistory = await this.getRiskHistory(child._id);

    res.json({
      child,
      vaccinations,
      riskHistory,
    });
  } catch (error) {
    console.error("Get child details error:", error);
    res.status(500).json({ message: "Error fetching child details" });
  }
};

/**
 * Get risk history for a child over time
 */
exports.getRiskHistory = async (childId) => {
  // This would ideally store risk scores over time
  // For now, we'll calculate based on vaccination status changes
  const vaccinations = await Vaccination.find({ childId })
    .sort({ updatedAt: 1 })
    .select("status updatedAt");

  const history = [];
  let currentScore = 0;

  for (const vax of vaccinations) {
    const total = await Vaccination.countDocuments({ childId });
    const completed = await Vaccination.countDocuments({
      childId,
      status: "completed"
    });
    const overdue = await Vaccination.countDocuments({
      childId,
      status: "overdue"
    });

    const riskResult = await predictRisk({
      overdueCount: overdue,
      missedAppointments: overdue,
      totalVaccines: total,
      completedVaccines: completed,
    });

    history.push({
      date: vax.updatedAt,
      riskScore: Math.round(riskResult.probability * 100),
      riskLevel: riskResult.riskLevel,
    });
  }

  return history;
};

/**
 * @swagger
 * /api/provider/children/{id}/vaccinations:
 *   get:
 *     summary: Get child vaccination history
 *     tags: [Provider]
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
 *         description: Vaccination history
 */
exports.getChildVaccinations = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: req.params.id,
      ...queryBase,
    });

    if (!child) {
      return res.status(404).json({ message: "Child not found or not assigned to you" });
    }

    const vaccinations = await Vaccination.find({ childId: child._id })
      .populate("administeredBy", "name")
      .sort({ dueDate: -1 });

    res.json(vaccinations);
  } catch (error) {
    console.error("Get child vaccinations error:", error);
    res.status(500).json({ message: "Error fetching vaccinations" });
  }
};

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
    const { notes } = req.body;
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination not found" });
    }

    // Verify provider has access to this child
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: vaccination.childId,
      ...queryBase,
    });

    if (!child) {
      return res.status(403).json({ message: "Not authorized" });
    }

    vaccination.status = "completed";
    vaccination.completedDate = new Date();
    vaccination.administeredBy = req.user._id;
    if (notes) vaccination.notes = notes;

    await vaccination.save();

    // Recalculate child's risk score
    await updateChildRiskScore(child._id);

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
 * /api/provider/vaccinations/{id}/correct:
 *   put:
 *     summary: Correct minor record errors
 *     tags: [Provider]
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
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *               appointmentTime:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Record corrected
 */
exports.correctRecord = async (req, res) => {
  try {
    const { scheduledDate, appointmentTime, notes } = req.body;
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination not found" });
    }

    // Verify provider has access
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: vaccination.childId,
      ...queryBase,
    });

    if (!child) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update fields
    if (scheduledDate) vaccination.scheduledDate = new Date(scheduledDate);
    if (appointmentTime) vaccination.appointmentTime = appointmentTime;
    if (notes) vaccination.notes = notes;

    await vaccination.save();

    res.json({
      message: "Record corrected successfully",
      data: vaccination,
    });
  } catch (error) {
    console.error("Correct record error:", error);
    res.status(500).json({ message: "Error correcting record" });
  }
};

/**
 * @swagger
 * /api/provider/appointments/today:
 *   get:
 *     summary: Get today's appointments
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's appointments
 */
exports.getTodayAppointments = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = await getProviderChildFilter(providerId);
    const assignedChildIds = await Child.find(query).select("_id").lean();

    const appointments = await Vaccination.find({
      childId: { $in: assignedChildIds.map((c) => c._id) },
      scheduledDate: {
        $gte: today,
        $lt: tomorrow,
      },
      approvalStatus: { $in: ["pending", "approved", "rejected"] },
    })
      .populate({   
        path: "childId",
        select: "name dateOfBirth parentId riskScore",
        populate: {
          path: "parentId",
          select: "name email phone",
        },
      })
      .sort({ appointmentTime: 1 });

    res.json(appointments);
  } catch (error) {
    console.error("Get today's appointments error:", error);
    res.status(500).json({ message: "Error fetching appointments" });
  }
};

/**
 * @swagger
 * /api/provider/appointments/{id}/approve:
 *   put:
 *     summary: Approve appointment
 *     tags: [Provider]
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
 *         description: Appointment approved
 */
exports.approveAppointment = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify provider has access
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: vaccination.childId,
      ...queryBase,
    });

    if (!child) {
      return res.status(403).json({ message: "Not authorized" });
    }

    vaccination.approvalStatus = "approved";
    vaccination.approvedAt = new Date();
    vaccination.approvedBy = req.user._id;

    await vaccination.save();

    res.json({ message: "Appointment approved", data: vaccination });
  } catch (error) {
    console.error("Approve appointment error:", error);
    res.status(500).json({ message: "Error approving appointment" });
  }
};

/**
 * @swagger
 * /api/provider/appointments/{id}/reject:
 *   put:
 *     summary: Reject appointment
 *     tags: [Provider]
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
 *         description: Appointment rejected
 */
exports.rejectAppointment = async (req, res) => {
  try {
    const { reason } = req.body;
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify provider has access
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: vaccination.childId,
      ...queryBase,
    });

    if (!child) {
      return res.status(403).json({ message: "Not authorized" });
    }

    vaccination.approvalStatus = "rejected";
    vaccination.rejectedAt = new Date();
    vaccination.rejectedBy = req.user._id;
    vaccination.rejectionReason = reason;

    await vaccination.save();

    res.json({ message: "Appointment rejected", data: vaccination });
  } catch (error) {
    console.error("Reject appointment error:", error);
    res.status(500).json({ message: "Error rejecting appointment" });
  }
};

/**
 * @swagger
 * /api/provider/appointments/{id}/reschedule:
 *   put:
 *     summary: Reschedule appointment
 *     tags: [Provider]
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
 *               newDate:
 *                 type: string
 *                 format: date
 *               newTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment rescheduled
 */
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { newDate, newTime } = req.body;
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Verify provider has access
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: vaccination.childId,
      ...queryBase,
    });

    if (!child) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (newDate) vaccination.scheduledDate = new Date(newDate);
    if (newTime) vaccination.appointmentTime = newTime;

    await vaccination.save();

    res.json({
      message: "Appointment rescheduled",
      data: vaccination
    });
  } catch (error) {
    console.error("Reschedule appointment error:", error);
    res.status(500).json({ message: "Error rescheduling appointment" });
  }
};

/**
 * @swagger
 * /api/provider/daily-summary:
 *   get:
 *     summary: Get daily vaccination summary
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily summary
 */
exports.getDailySummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get children assigned to this provider
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const assignedChildren = await Child.find(queryBase);
    const childIds = assignedChildren.map(c => c._id);

    const summary = {
      date: today.toISOString().split("T")[0],
      totalAssignedChildren: assignedChildren.length,
      appointmentsToday: await Vaccination.countDocuments({
        childId: { $in: childIds },
        scheduledDate: { $gte: today, $lt: tomorrow },
      }),
      completedToday: await Vaccination.countDocuments({
        childId: { $in: childIds },
        status: "completed",
        completedDate: { $gte: today, $lt: tomorrow },
      }),
      overdueCount: await Vaccination.countDocuments({
        childId: { $in: childIds },
        status: "overdue",
      }),
      highRiskCount: assignedChildren.filter(c => c.riskScore >= 50).length,
    };

    res.json(summary);
  } catch (error) {
    console.error("Get daily summary error:", error);
    res.status(500).json({ message: "Error fetching daily summary" });
  }
};

/**
 * @swagger
 * /api/provider/overdue:
 *   get:
 *     summary: Get overdue vaccinations list
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue list
 */
exports.getOverdueList = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const assignedChildren = await Child.find(queryBase);
    const childIds = assignedChildren.map(c => c._id);

    const overdue = await Vaccination.find({
      childId: { $in: childIds },
      status: "overdue",
    })
      .populate({
        path: "childId",
        select: "name dateOfBirth parentId riskScore",
        populate: {
          path: "parentId",
          select: "name email phone",
        },
      })
      .sort({ dueDate: 1 });

    res.json(overdue);
  } catch (error) {
    console.error("Get overdue list error:", error);
    res.status(500).json({ message: "Error fetching overdue list" });
  }
};

/**
 * @swagger
 * /api/provider/upcoming:
 *   get:
 *     summary: Get upcoming vaccinations
 *     tags: [Provider]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 7
 *     responses:
 *       200:
 *         description: Upcoming vaccinations
 */
exports.getUpcomingVaccinations = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const assignedChildren = await Child.find(queryBase);
    const childIds = assignedChildren.map(c => c._id);

    const upcoming = await Vaccination.find({
      childId: { $in: childIds },
      status: "pending",
      dueDate: { $gte: today, $lte: futureDate },
    })
      .populate({
        path: "childId",
        select: "name dateOfBirth parentId riskScore",
        populate: {
          path: "parentId",
          select: "name email phone",
        },
      })
      .sort({ dueDate: 1 });

    res.json(upcoming);
  } catch (error) {
    console.error("Get upcoming vaccinations error:", error);
    res.status(500).json({ message: "Error fetching upcoming vaccinations" });
  }
};

/**
 * @swagger
 * /api/provider/children/{id}/risk:
 *   get:
 *     summary: Get child risk prediction with recommendations
 *     tags: [Provider]
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
 *         description: Risk prediction with recommendations
 */
exports.getChildRiskPrediction = async (req, res) => {
  try {
    const providerId = await getScopedProviderId(req);
    if (!providerId) return res.status(401).json({ message: "Unauthorized" });

    const queryBase = await getProviderChildFilter(providerId);

    const child = await Child.findOne({
      _id: req.params.id,
      ...queryBase,
    });

    if (!child) {
      return res.status(404).json({ message: "Child not found or not assigned to you" });
    }

    const totalVaccines = await Vaccination.countDocuments({ childId: child._id });
    const completedVaccines = await Vaccination.countDocuments({
      childId: child._id,
      status: "completed"
    });
    const overdueVaccines = await Vaccination.countDocuments({
      childId: child._id,
      status: "overdue"
    });

    const lastVaccination = await Vaccination.findOne({
      childId: child._id,
      status: "completed",
    }).sort({ completedDate: -1 });

    const daysSinceLast = lastVaccination?.completedDate
      ? Math.floor((new Date() - lastVaccination.completedDate) / (1000 * 60 * 60 * 24))
      : 30;

    const riskResult = await predictRisk({
      overdueCount: overdueVaccines,
      missedAppointments: overdueVaccines,
      daysSinceLastVaccination: daysSinceLast,
      previousRiskScore: child.riskScore || 0,
      totalVaccines,
      completedVaccines,
    });

    // Generate specific recommendations
    const recommendations = [];
    if (riskResult.riskLevel === "High") {
      recommendations.push("Schedule catch-up vaccination immediately");
      recommendations.push("Consider scheduling earlier appointment slot");
    } else if (riskResult.riskLevel === "Medium") {
      recommendations.push("Send additional reminder to parent");
      recommendations.push("Monitor for next 7 days");
    }

    res.json({
      childId: child._id,
      childName: child.name,
      riskProbability: riskResult.probability,
      riskLevel: riskResult.riskLevel,
      factors: riskResult.factors,
      recommendations,
      suggestedAction: riskResult.riskLevel === "High"
        ? "Schedule earlier"
        : "Continue regular schedule",
    });
  } catch (error) {
    console.error("Get risk prediction error:", error);
    res.status(500).json({ message: "Error getting risk prediction" });
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

module.exports = exports;
