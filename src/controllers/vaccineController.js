const Vaccine = require("../models/Vaccine");

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
 *                 example: "Diphtheria, Pertussis, and Tetanus - First dose"
 *               weeksAfterBirth:
 *                 type: number
 *                 example: 6
 *               dosesRequired:
 *                 type: number
 *                 example: 3
 *               doseIntervalWeeks:
 *                 type: number
 *                 example: 4
 *               isCritical:
 *                 type: boolean
 *                 example: true
 *               applicableGenders:
 *                 type: string
 *                 enum: [male, female, both]
 *                 example: "both"
 *               minimumAgeWeeks:
 *                 type: number
 *                 example: 6
 *               maximumAgeWeeks:
 *                 type: number
 *                 example: 52
 *               sideEffects:
 *                 type: string
 *                 example: "Mild fever, redness at injection site"
 *               precautions:
 *                 type: string
 *                 example: "Should not be given if child is ill"
 *     responses:
 *       201:
 *         description: Vaccine created successfully
 *       400:
 *         description: Validation error or vaccine already exists
 */
exports.createVaccine = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      weeksAfterBirth,
      dosesRequired,
      doseIntervalWeeks,
      isCritical,
      applicableGenders,
      minimumAgeWeeks,
      maximumAgeWeeks,
      sideEffects,
      precautions,
    } = req.body;

    // Check if vaccine with same name or code already exists
    const existingVaccine = await Vaccine.findOne({
      $or: [{ name: name }, { code: code }],
    });

    if (existingVaccine) {
      return res.status(400).json({
        message: existingVaccine.name === name 
          ? "Vaccine with this name already exists" 
          : "Vaccine with this code already exists",
      });
    }

    const vaccine = await Vaccine.create({
      name,
      code,
      description,
      weeksAfterBirth,
      dosesRequired: dosesRequired || 1,
      doseIntervalWeeks: doseIntervalWeeks || 0,
      isCritical: isCritical || false,
      applicableGenders: applicableGenders || "both",
      minimumAgeWeeks: minimumAgeWeeks || 0,
      maximumAgeWeeks,
      sideEffects,
      precautions,
    });

    res.status(201).json({
      message: "Vaccine created successfully",
      data: vaccine,
    });
  } catch (error) {
    console.error("Create vaccine error:", error);
    res.status(500).json({ message: "Error creating vaccine" });
  }
};

/**
 * @swagger
 * /api/vaccines:
 *   get:
 *     summary: Get all vaccines
 *     tags: [Vaccines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive vaccines
 *     responses:
 *       200:
 *         description: List of vaccines
 */
exports.getAllVaccines = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    const filter = {};
    if (!includeInactive) {
      filter.isActive = true;
    }

    const vaccines = await Vaccine.find(filter).sort({ weeksAfterBirth: 1, name: 1 });

    res.json(vaccines);
  } catch (error) {
    console.error("Get vaccines error:", error);
    res.status(500).json({ message: "Error fetching vaccines" });
  }
};

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
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: Vaccine data
 *       404:
 *         description: Vaccine not found
 */
exports.getVaccineById = async (req, res) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({ message: "Vaccine not found" });
    }

    res.json(vaccine);
  } catch (error) {
    console.error("Get vaccine error:", error);
    res.status(500).json({ message: "Error fetching vaccine" });
  }
};

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
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
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
 *               isActive:
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
 *       200:
 *         description: Vaccine updated
 *       404:
 *         description: Vaccine not found
 */
exports.updateVaccine = async (req, res) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({ message: "Vaccine not found" });
    }

    const {
      name,
      code,
      description,
      weeksAfterBirth,
      dosesRequired,
      doseIntervalWeeks,
      isCritical,
      isActive,
      applicableGenders,
      minimumAgeWeeks,
      maximumAgeWeeks,
      sideEffects,
      precautions,
    } = req.body;

    // Check for duplicate name or code (excluding current vaccine)
    if (name || code) {
      const existingVaccine = await Vaccine.findOne({
        $or: [
          { name: name, _id: { $ne: req.params.id } },
          { code: code, _id: { $ne: req.params.id } },
        ],
      });

      if (existingVaccine) {
        return res.status(400).json({
          message: existingVaccine.name === name
            ? "Vaccine with this name already exists"
            : "Vaccine with this code already exists",
        });
      }
    }

    // Update fields
    if (name) vaccine.name = name;
    if (code) vaccine.code = code;
    if (description !== undefined) vaccine.description = description;
    if (weeksAfterBirth !== undefined) vaccine.weeksAfterBirth = weeksAfterBirth;
    if (dosesRequired !== undefined) vaccine.dosesRequired = dosesRequired;
    if (doseIntervalWeeks !== undefined) vaccine.doseIntervalWeeks = doseIntervalWeeks;
    if (isCritical !== undefined) vaccine.isCritical = isCritical;
    if (isActive !== undefined) vaccine.isActive = isActive;
    if (applicableGenders) vaccine.applicableGenders = applicableGenders;
    if (minimumAgeWeeks !== undefined) vaccine.minimumAgeWeeks = minimumAgeWeeks;
    if (maximumAgeWeeks !== undefined) vaccine.maximumAgeWeeks = maximumAgeWeeks;
    if (sideEffects !== undefined) vaccine.sideEffects = sideEffects;
    if (precautions !== undefined) vaccine.precautions = precautions;

    await vaccine.save();

    res.json({
      message: "Vaccine updated successfully",
      data: vaccine,
    });
  } catch (error) {
    console.error("Update vaccine error:", error);
    res.status(500).json({ message: "Error updating vaccine" });
  }
};

/**
 * @swagger
 * /api/vaccines/{id}:
 *   delete:
 *     summary: Delete vaccine (soft delete)
 *     tags: [Vaccines]
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
 *         description: Vaccine deleted
 *       404:
 *         description: Vaccine not found
 */
exports.deleteVaccine = async (req, res) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({ message: "Vaccine not found" });
    }

    // Soft delete - just mark as inactive
    vaccine.isActive = false;
    await vaccine.save();

    res.json({ message: "Vaccine deleted successfully" });
  } catch (error) {
    console.error("Delete vaccine error:", error);
    res.status(500).json({ message: "Error deleting vaccine" });
  }
};

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
 *         description: Vaccines seeded successfully
 */
exports.seedVaccines = async (req, res) => {
  try {
    const defaultVaccines = [
      {
        name: "BCG",
        code: "BCG",
        description: "Bacillus Calmette-Guérin - Tuberculosis vaccine",
        weeksAfterBirth: 0,
        dosesRequired: 1,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, swelling at injection site",
        precautions: "Should not be given to immunocompromised children",
      },
      {
        name: "OPV 0",
        code: "OPV-0",
        description: "Oral Polio Vaccine - Zero dose",
        weeksAfterBirth: 0,
        dosesRequired: 1,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, diarrhea",
        precautions: "Should not be given if child has severe illness",
      },
      {
        name: "Hepatitis B",
        code: "HEP-B",
        description: "Hepatitis B vaccine - First dose",
        weeksAfterBirth: 0,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, soreness at injection site",
        precautions: "Consult doctor if premature birth",
      },
      {
        name: "DPT 1",
        code: "DPT-1",
        description: "Diphtheria, Pertussis, and Tetanus - First dose",
        weeksAfterBirth: 6,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, redness at injection site, irritability",
        precautions: "Should not be given if child has fever",
      },
      {
        name: "DPT 2",
        code: "DPT-2",
        description: "Diphtheria, Pertussis, and Tetanus - Second dose",
        weeksAfterBirth: 10,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, redness at injection site",
        precautions: "Should not be given if child is ill",
      },
      {
        name: "DPT 3",
        code: "DPT-3",
        description: "Diphtheria, Pertussis, and Tetanus - Third dose",
        weeksAfterBirth: 14,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, swelling at injection site",
        precautions: "Should not be given if child has fever",
      },
      {
        name: "OPV 1",
        code: "OPV-1",
        description: "Oral Polio Vaccine - First dose",
        weeksAfterBirth: 6,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, diarrhea",
        precautions: "Should not be given if child has severe illness",
      },
      {
        name: "OPV 2",
        code: "OPV-2",
        description: "Oral Polio Vaccine - Second dose",
        weeksAfterBirth: 10,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever",
        precautions: "Consult doctor if any concerns",
      },
      {
        name: "OPV 3",
        code: "OPV-3",
        description: "Oral Polio Vaccine - Third dose",
        weeksAfterBirth: 14,
        dosesRequired: 3,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever",
        precautions: "Should not be given if child is ill",
      },
      {
        name: "Measles",
        code: "MEASLES",
        description: "Measles vaccine",
        weeksAfterBirth: 36, // 9 months
        dosesRequired: 2,
        doseIntervalWeeks: 4,
        isCritical: true,
        applicableGenders: "both",
        sideEffects: "Mild fever, rash",
        precautions: "Should not be given if child has fever",
      },
      {
        name: "Vitamin A",
        code: "VIT-A",
        description: "Vitamin A supplementation",
        weeksAfterBirth: 26, // 6 months
        dosesRequired: 5,
        doseIntervalWeeks: 26,
        isCritical: false,
        applicableGenders: "both",
        sideEffects: "Usually none",
        precautions: "Consult doctor for proper dosage",
      },
    ];

    // Check if active vaccines already exist
    const existingCount = await Vaccine.countDocuments({ isActive: true });
    if (existingCount > 0) {
      return res.status(400).json({
        message: "Active vaccines already exist. Please delete existing vaccines first or use individual create endpoint.",
      });
    }

    const vaccines = await Vaccine.insertMany(defaultVaccines);

    res.status(201).json({
      message: "Default vaccines seeded successfully",
      count: vaccines.length,
      data: vaccines,
    });
  } catch (error) {
    console.error("Seed vaccines error:", error);
    res.status(500).json({ message: "Error seeding vaccines" });
  }
};

module.exports = exports;
