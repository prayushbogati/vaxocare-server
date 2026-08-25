const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");
const { calculateRiskProbability, getRiskLevel } = require("../ai/riskModel");

/**
 * AI Admin Controller
 * 
 * Provides AI-powered risk analysis for admin dashboard.
 * Uses logistic regression for risk prediction.
 */

// Helper: Calculate risk for a single child
const calculateChildRisk = async (child) => {
  try {
    const totalVaccines = await Vaccination.countDocuments({ childId: child._id });
    const completed = await Vaccination.countDocuments({
      childId: child._id,
      status: "completed"
    });
    const overdue = await Vaccination.countDocuments({
      childId: child._id,
      status: "overdue"
    });

    const completionRate = totalVaccines === 0 ? 0 : (completed / totalVaccines) * 100;

    // Get last vaccination date
    const lastVaccination = await Vaccination.findOne({
      childId: child._id,
      status: "completed"
    }).sort({ completedDate: -1 });

    const daysSinceLast = lastVaccination?.completedDate
      ? Math.floor((new Date() - lastVaccination.completedDate) / (1000 * 60 * 60 * 24))
      : 30; // Default 30 days if no previous vaccination

    const features = {
      overdueCount: overdue,
      missedAppointments: overdue,
      daysSinceLast,
      completionRate
    };

    const probability = calculateRiskProbability(features);
    const riskLevel = getRiskLevel(probability);

    return {
      childId: child._id,
      name: child.name,
      dateOfBirth: child.dateOfBirth,
      probability: Number(probability.toFixed(3)),
      riskLevel,
      overdueCount: overdue,
      completedCount: completed,
      totalVaccines,
      completionRate: Number(completionRate.toFixed(2)),
      daysSinceLast
    };
  } catch (error) {
    console.error("Error calculating child risk:", error);
    return null;
  }
};

/**
 * @swagger
 * /api/admin/ai/all-risk:
 *   get:
 *     summary: Get all children with AI risk analysis
 *     tags: [AI Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all children with risk scores
 */
exports.getAllChildrenRisk = async (req, res) => {
  try {
    const children = await Child.find({ isActive: true });
    const riskData = [];

    for (const child of children) {
      const risk = await calculateChildRisk(child);
      if (risk) {
        riskData.push(risk);
      }
    }

    // Sort by highest risk first
    riskData.sort((a, b) => b.probability - a.probability);

    res.json(riskData);
  } catch (error) {
    console.error("Get all children risk error:", error);
    res.status(500).json({ message: "Error fetching risk data" });
  }
};

/**
 * @swagger
 * /api/admin/ai/high-risk:
 *   get:
 *     summary: Get only high risk children
 *     tags: [AI Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of high risk children
 */
exports.getHighRiskChildren = async (req, res) => {
  try {
    const children = await Child.find({ isActive: true });
    const highRisk = [];

    for (const child of children) {
      const risk = await calculateChildRisk(child);
      
      if (risk && risk.riskLevel === "High") {
        highRisk.push(risk);
      }
    }

    // Sort by highest probability first
    highRisk.sort((a, b) => b.probability - a.probability);

    res.json(highRisk);
  } catch (error) {
    console.error("Get high risk error:", error);
    res.status(500).json({ message: "Error fetching high risk children" });
  }
};

/**
 * @swagger
 * /api/admin/ai/medium-risk:
 *   get:
 *     summary: Get medium risk children
 *     tags: [AI Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of medium risk children
 */
exports.getMediumRiskChildren = async (req, res) => {
  try {
    const children = await Child.find({ isActive: true });
    const mediumRisk = [];

    for (const child of children) {
      const risk = await calculateChildRisk(child);
      
      if (risk && risk.riskLevel === "Medium") {
        mediumRisk.push(risk);
      }
    }

    mediumRisk.sort((a, b) => b.probability - a.probability);
    res.json(mediumRisk);
  } catch (error) {
    console.error("Get medium risk error:", error);
    res.status(500).json({ message: "Error fetching medium risk children" });
  }
};

/**
 * @swagger
 * /api/admin/ai/low-risk:
 *   get:
 *     summary: Get low risk children
 *     tags: [AI Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of low risk children
 */
exports.getLowRiskChildren = async (req, res) => {
  try {
    const children = await Child.find({ isActive: true });
    const lowRisk = [];

    for (const child of children) {
      const risk = await calculateChildRisk(child);
      
      if (risk && risk.riskLevel === "Low") {
        lowRisk.push(risk);
      }
    }

    lowRisk.sort((a, b) => b.probability - a.probability);
    res.json(lowRisk);
  } catch (error) {
    console.error("Get low risk error:", error);
    res.status(500).json({ message: "Error fetching low risk children" });
  }
};

/**
 * @swagger
 * /api/admin/ai/stats:
 *   get:
 *     summary: Get AI dashboard statistics
 *     tags: [AI Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI risk distribution statistics
 */
exports.getAIDashboardStats = async (req, res) => {
  try {
    const children = await Child.find({ isActive: true });
    
    let high = 0;
    let medium = 0;
    let low = 0;
    let totalRiskScore = 0;

    for (const child of children) {
      const risk = await calculateChildRisk(child);
      
      if (risk) {
        if (risk.riskLevel === "High") high++;
        else if (risk.riskLevel === "Medium") medium++;
        else low++;
        
        totalRiskScore += risk.probability;
      }
    }

    const avgRiskScore = children.length > 0 
      ? (totalRiskScore / children.length).toFixed(3) 
      : 0;

    res.json({
      totalChildren: children.length,
      highRisk: high,
      mediumRisk: medium,
      lowRisk: low,
      averageRiskScore: Number(avgRiskScore),
      distribution: {
        high: children.length > 0 ? ((high / children.length) * 100).toFixed(1) : 0,
        medium: children.length > 0 ? ((medium / children.length) * 100).toFixed(1) : 0,
        low: children.length > 0 ? ((low / children.length) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error("Get AI stats error:", error);
    res.status(500).json({ message: "Error fetching AI statistics" });
  }
};

/**
 * @swagger
 * /api/admin/ai/risk/:childId:
 *   get:
 *     summary: Get risk analysis for specific child
 *     tags: [AI Admin]
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
 *         description: Detailed risk analysis
 */
exports.getChildRiskAnalysis = async (req, res) => {
  try {
    const { childId } = req.params;
    
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    const risk = await calculateChildRisk(child);
    
    if (!risk) {
      return res.status(500).json({ message: "Error calculating risk" });
    }

    // Add recommendations based on risk level
    const recommendations = [];
    if (risk.riskLevel === "High") {
      recommendations.push("Immediate phone call follow-up required");
      recommendations.push("Schedule catch-up vaccination at earliest");
      recommendations.push("Consider home visit if no response");
    } else if (risk.riskLevel === "Medium") {
      recommendations.push("Send additional email reminders");
      recommendations.push("Monitor for next 7 days");
    } else {
      recommendations.push("Continue regular reminder schedule");
    }

    res.json({
      ...risk,
      recommendations
    });
  } catch (error) {
    console.error("Get child risk analysis error:", error);
    res.status(500).json({ message: "Error fetching risk analysis" });
  }
};

