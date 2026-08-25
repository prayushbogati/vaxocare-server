const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");
const { predictRisk } = require("../ai/riskModel");

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
 *               givenVaccines:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["BCG", "OPV 0", "Hepatitis B"]
 *                 description: Optional - vaccines already given by the child
 *     responses:
 *       201:
 *         description: Child created successfully
 *       400:
 *         description: Validation error
 */
exports.createChild = async (req, res) => {
  try {
    const { name, dateOfBirth, gender, bloodGroup, allergies, givenVaccines } = req.body;

    // Validate dateOfBirth is not in the future
    const dob = new Date(dateOfBirth);
    if (dob > new Date()) {
      return res.status(400).json({ message: "Date of birth cannot be in the future" });
    }

    // Determine which provider should be assigned to this child for provider dashboard access.
    // Priority:
    // 1) parent user selectedProviderId (stored by provider-selection endpoints)
    // 2) default to provider named "Jane Doe"
    const selectedProviderId = req.user?.selectedProviderId ? req.user.selectedProviderId : null;

    let assignedProviderId = selectedProviderId;
    if (!assignedProviderId) {
      const janeDoeProvider = await require("../models/User").findOne({
        role: "provider",
        name: "Jane Doe",
        isApproved: true,
        isActive: true,
      }).select("_id").lean();

      assignedProviderId = janeDoeProvider?._id || null;
    }

    // Create child
    const child = await Child.create({
      name,
      dateOfBirth,
      gender,
      bloodGroup,
      allergies,
      parentId: req.user._id,
      assignedProviderId,
    });

    // Auto-generate vaccination schedule
    // If parent provides givenVaccines, use those; otherwise default to assuming missed vaccines are given
    const hasGivenVaccines = givenVaccines && givenVaccines.length > 0;
    await generateVaccinationSchedule(child._id, dateOfBirth, hasGivenVaccines ? givenVaccines : null);

    // Calculate initial risk
    await calculateChildRisk(child._id);

    // Check if there are missed vaccinations that need review
    const missedVaccinations = await Vaccination.find({
      childId: child._id,
      status: { $in: ["completed", "overdue"] }
    });

    const needsReview = missedVaccinations.length > 0 && !hasGivenVaccines;

    res.status(201).json({
      message: "Child profile created successfully",
      data: child,
      needsReview,
      missedVaccinesCount: missedVaccinations.length
    });
  } catch (error) {
    console.error("Create child error:", error);
    res.status(500).json({ message: "Error creating child profile" });
  }
};

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
exports.getChildren = async (req, res) => {
  try {
    const selectedProviderId =
      req.user?.selectedProviderId || req.user?.selectedProviderId === ""
        ? req.user.selectedProviderId
        : null;

    const query = {
      parentId: req.user._id,
      isActive: true,
    };

    // Parent dashboard should only show children assigned to the selected provider.
    if (selectedProviderId) {
      query.assignedProviderId = selectedProviderId;
    }

    const children = await Child.find(query).sort({ createdAt: -1 });

    res.json(children);
  } catch (error) {
    console.error("Get children error:", error);
    res.status(500).json({ message: "Error fetching children" });
  }
};

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
 *       404:
 *         description: Child not found
 */
exports.getChildById = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check ownership (unless admin/provider)
    if (
      child.parentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "provider"
    ) {
      return res.status(403).json({ message: "Not authorized to view this child" });
    }

    // Parent dashboard should only allow viewing children assigned to selected provider.
    if (req.user.role === "parent") {
      const selectedProviderId = req.user?.selectedProviderId || null;
      if (selectedProviderId && child.assignedProviderId?.toString() !== selectedProviderId.toString()) {
        return res.status(403).json({ message: "Not authorized to view this child's provider data" });
      }
    }

    res.json(child);
  } catch (error) {
    console.error("Get child error:", error);
    res.status(500).json({ message: "Error fetching child" });
  }
};

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
 *               allergies:
 *                 type: string
 *     responses:
 *       200:
 *         description: Child updated
 */
exports.updateChild = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check ownership
    if (child.parentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedChild = await Child.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      message: "Child updated successfully",
      data: updatedChild,
    });
  } catch (error) {
    console.error("Update child error:", error);
    res.status(500).json({ message: "Error updating child" });
  }
};

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
exports.deleteChild = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check ownership (unless admin)
    if (child.parentId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Soft delete
    child.isActive = false;
    await child.save();

    res.json({ message: "Child deleted successfully" });
  } catch (error) {
    console.error("Delete child error:", error);
    res.status(500).json({ message: "Error deleting child" });
  }
};

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
 *       404:
 *         description: Child not found
 */
exports.getVaccinationsForReview = async (req, res) => {
  try {
    const child = await Child.findById(req.params.id);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check ownership (unless admin/provider)
    if (
      child.parentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "provider"
    ) {
      return res.status(403).json({ message: "Not authorized to view this child" });
    }

    // Automatically update any pending vaccines to overdue if due date has passed
    await updateOverdueVaccinations(child._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all vaccinations that were due before today (missed)
    const missedVaccinations = await Vaccination.find({
      childId: child._id,
      dueDate: { $lt: today }
    }).sort({ dueDate: 1 });

    // Transform to include isGiven flag (completed = given, overdue = not given)
    const transformedVaccinations = missedVaccinations.map(v => ({
      _id: v._id,
      vaccineName: v.vaccineName,
      dueDate: v.dueDate,
      status: v.status,
      completedDate: v.completedDate,
      isGiven: v.status === "completed" // true if completed (assumed given), false if overdue
    }));

    // Check if all missed vaccines have been reviewed
    const needsReview = transformedVaccinations.some(v => v.status === "completed" || v.status === "overdue");

    res.json({
      needsReview,
      childId: child._id,
      childName: child.name,
      registrationDate: child.createdAt,
      missedVaccinations: transformedVaccinations,
      totalMissed: transformedVaccinations.length,
      confirmedGiven: transformedVaccinations.filter(v => v.isGiven).length,
      notGiven: transformedVaccinations.filter(v => !v.isGiven).length
    });
  } catch (error) {
    console.error("Get vaccinations for review error:", error);
    res.status(500).json({ message: "Error fetching vaccinations for review" });
  }
};

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
 *                 description: Array of vaccination IDs that were NOT actually given
 *     responses:
 *       200:
 *         description: Vaccination confirmation successful
 *       400:
 *         description: Validation error
 */
exports.confirmVaccinations = async (req, res) => {
  try {
    const { id } = req.params;
    const { notGivenVaccines = [] } = req.body;

    const child = await Child.findById(id);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // Check ownership (unless admin/provider)
    if (
      child.parentId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "provider"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // First, automatically update any pending vaccines to overdue if their due date has passed
    await updateOverdueVaccinations(id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all missed vaccinations (due before today)
    const missedVaccinations = await Vaccination.find({
      childId: id,
      dueDate: { $lt: today }
    });

    let confirmedGiven = 0;
    let notGivenCount = 0;

    // Update each vaccination based on parent's confirmation
    for (const vaccination of missedVaccinations) {
      const isNotGiven = notGivenVaccines.some(
        notGivenId => notGivenId.toString() === vaccination._id.toString()
      );

      if (isNotGiven) {
        // Parent confirmed this vaccine was NOT given
        vaccination.status = "overdue";
        vaccination.completedDate = null;
        notGivenCount++;
      } else {
        // Parent confirmed this vaccine WAS given
        vaccination.status = "completed";
        vaccination.completedDate = vaccination.dueDate;
        confirmedGiven++;
      }

      await vaccination.save();
    }

    // Recalculate child's risk score after confirmation
    await calculateChildRisk(id);

    // Get updated vaccination counts
    const totalVaccinations = await Vaccination.countDocuments({ childId: id });
    const completedCount = await Vaccination.countDocuments({ childId: id, status: "completed" });
    const overdueCount = await Vaccination.countDocuments({ childId: id, status: "overdue" });
    const pendingCount = await Vaccination.countDocuments({ childId: id, status: "pending" });

    res.json({
      message: "Vaccination review completed successfully",
      data: {
        totalMissed: missedVaccinations.length,
        confirmedGiven,
        notGiven: notGivenCount,
        totals: {
          total: totalVaccinations,
          completed: completedCount,
          overdue: overdueCount,
          pending: pendingCount
        }
      }
    });
  } catch (error) {
    console.error("Confirm vaccinations error:", error);
    res.status(500).json({ message: "Error confirming vaccinations" });
  }
};

// Helper: Generate vaccination schedule
// givenVaccines: optional array of vaccine names that parent explicitly said were given
const generateVaccinationSchedule = async (childId, dateOfBirth, givenVaccines = null) => {
  const vaccineSchedule = require("../utils/vaccineSchedule");
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const registrationDate = today;

  // If givenVaccines is provided, normalize to lowercase for comparison
  const explicitlyGiven = givenVaccines
    ? givenVaccines.map(v => v.toLowerCase().trim())
    : [];

  for (const vaccine of vaccineSchedule) {
    // Calculate due date
    const dueDate = new Date(dob);
    dueDate.setDate(dueDate.getDate() + vaccine.weeks * 7);

    // Determine status based on due date and whether vaccine was given
    let status = "pending";
    const vaccineNameLower = vaccine.name.toLowerCase().trim();

    if (dueDate < today) {
      // Vaccine was due before today (missed)
      if (givenVaccines === null) {
        // No explicit list provided - assume all missed vaccines are given
        status = "completed";
      } else if (explicitlyGiven.includes(vaccineNameLower)) {
        // Parent explicitly said this vaccine was given
        status = "completed";
      } else {
        // Parent explicitly said this vaccine was NOT given
        status = "overdue";
      }
    }

    // Determine completed date for vaccines that are marked as completed
    let completedDate = null;
    if (status === "completed") {
      // Set completed date to the due date (assuming it was given around that time)
      completedDate = dueDate;
    }

    await Vaccination.create({
      childId,
      vaccineName: vaccine.name,
      dueDate,
      status,
      completedDate
    });
  }
};

// Helper: Automatically mark pending vaccines as overdue if due date has passed
const updateOverdueVaccinations = async (childId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all pending vaccines with due date before today
    const overdueVaccines = await Vaccination.updateMany(
      {
        childId,
        status: "pending",
        dueDate: { $lt: today }
      },
      {
        $set: { status: "overdue" }
      }
    );

    return overdueVaccines.modifiedCount; // Return count of updated vaccines
  } catch (error) {
    console.error("Error updating overdue vaccinations:", error);
    return 0;
  }
};

// Helper: Calculate child risk score
const calculateChildRisk = async (childId) => {
  try {
    // First, automatically mark any pending vaccines as overdue if their due date has passed
    await updateOverdueVaccinations(childId);

    const totalVaccines = await Vaccination.countDocuments({ childId });
    const overdueVaccines = await Vaccination.countDocuments({
      childId,
      status: "overdue",
    });
    const completedVaccines = await Vaccination.countDocuments({
      childId,
      status: "completed",
    });

    // Use AI model
    const riskResult = await predictRisk({
      overdueCount: overdueVaccines,
      missedAppointments: overdueVaccines,
      totalVaccines,
      completedVaccines,
    });

    // Update child with risk score
    await Child.findByIdAndUpdate(childId, {
      riskScore: Math.round(riskResult.probability * 100),
    });

    return riskResult;
  } catch (error) {
    console.error("Error calculating risk:", error);
  }
};

module.exports = exports;

