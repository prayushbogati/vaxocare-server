const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const SystemConfig = require("../models/SystemConfig");
const crypto = require("crypto");

/**
 * Get client IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalChildren = await Child.countDocuments({ isActive: true });
    const totalVaccines = await Vaccination.countDocuments();
    const completedVaccines = await Vaccination.countDocuments({ status: "completed" });
    const pendingVaccines = await Vaccination.countDocuments({ status: "pending" });
    const overdueVaccines = await Vaccination.countDocuments({ status: "overdue" });

    const completionRate = totalVaccines > 0 
      ? ((completedVaccines / totalVaccines) * 100).toFixed(2) 
      : 0;

    res.json({
      totalChildren,
      totalVaccines,
      completedVaccines,
      pendingVaccines,
      overdueVaccines,
      completionRate,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Error fetching dashboard stats" });
  }
};

/**
 * @swagger
 * /api/admin/trends:
 *   get:
 *     summary: Get monthly vaccination trends
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly trends data
 */
exports.getMonthlyTrends = async (req, res) => {
  try {
    const trends = await Vaccination.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: { $month: "$completedDate" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json(trends);
  } catch (error) {
    console.error("Trends error:", error);
    res.status(500).json({ message: "Error fetching trends" });
  }
};

/**
 * @swagger
 * /api/admin/high-risk:
 *   get:
 *     summary: Get high risk children
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of high risk children
 */
exports.getHighRiskChildren = async (req, res) => {
  try {
    const highRiskChildren = await Child.find({
      riskScore: { $gte: 50 },
      isActive: true,
    })
      .select("name dateOfBirth riskScore")
      .sort({ riskScore: -1 })
      .limit(10);
    res.json(highRiskChildren);
  } catch (error) {
    console.error("High risk error:", error);
    res.status(500).json({ message: "Error fetching high risk children" });
  }
};

/**
 * @swagger
 * /api/admin/anomalies:
 *   get:
 *     summary: Get detected anomalies
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of anomalies
 */
exports.getAnomalies = async (req, res) => {
  try {
    const anomalies = await Vaccination.find({ anomalyFlag: true })
      .populate("childId", "name")
      .sort({ updatedAt: -1 })
      .limit(20);
    res.json(anomalies);
  } catch (error) {
    console.error("Anomalies error:", error);
    res.status(500).json({ message: "Error fetching anomalies" });
  }
};

/**
 * @swagger
 * /api/admin/vaccination-coverage:
 *   get:
 *     summary: Get vaccination coverage by vaccine type
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coverage data
 */
exports.getVaccinationCoverage = async (req, res) => {
  try {
    const coverage = await Vaccination.aggregate([
      {
        $group: {
          _id: "$vaccineName",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
        },
      },
      {
        $project: {
          vaccineName: "$_id",
          total: 1,
          completed: 1,
          pending: 1,
          overdue: 1,
          coveragePercentage: { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json(coverage);
  } catch (error) {
    console.error("Coverage error:", error);
    res.status(500).json({ message: "Error fetching coverage data" });
  }
};

/**
 * @swagger
 * /api/admin/all-users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive, isApproved, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    res.json({ users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Error fetching user" });
  }
};

exports.activateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isActive = true;
    user.deactivatedAt = null;
    user.deactivationReason = "";
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "USER_ACTIVATED",
      targetType: "User",
      targetId: user._id,
      description: `User ${user.email} activated by admin`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: "User activated successfully", data: user });
  } catch (error) {
    console.error("Activate user error:", error);
    res.status(500).json({ message: "Error activating user" });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || "Deactivated by admin";
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "USER_DEACTIVATED",
      targetType: "User",
      targetId: user._id,
      description: `User ${user.email} deactivated. Reason: ${reason || 'Not specified'}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: "User deactivated successfully", data: user });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({ message: "Error deactivating user" });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "USER_ROLE_CHANGED",
      targetType: "User",
      targetId: user._id,
      description: `User ${user.email} role changed from ${oldRole} to ${role}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: { oldRole, newRole: role },
    });

    res.json({ message: "Role updated successfully", data: user });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Error updating role" });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    user.password = newPassword;
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: user._id,
      description: `Password reset by admin for user ${user.email}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
};

exports.createProvider = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists with this email" });

    const user = await User.create({
      name, email, password,
      role: "provider",
      phone: phone || "",
      address: address || "",
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    await AuditLog.log({
      userId: req.user._id,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id,
      description: `Provider ${email} created by admin`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      message: "Provider created successfully",
      data: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved },
    });
  } catch (error) {
    console.error("Create provider error:", error);
    res.status(500).json({ message: "Error creating provider" });
  }
};

exports.getPendingProviders = async (req, res) => {
  try {
    const providers = await User.find({ role: "provider", isApproved: false, isActive: true }).select("-password");
    res.json(providers);
  } catch (error) {
    console.error("Get pending providers error:", error);
    res.status(500).json({ message: "Error fetching pending providers" });
  }
};

exports.approveProvider = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Provider not found" });
    if (user.role !== "provider") return res.status(400).json({ message: "User is not a provider" });

    user.isApproved = true;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "PROVIDER_APPROVED",
      targetType: "User",
      targetId: user._id,
      description: `Provider ${user.email} approved by admin`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: "Provider approved successfully", data: user });
  } catch (error) {
    console.error("Approve provider error:", error);
    res.status(500).json({ message: "Error approving provider" });
  }
};

exports.rejectProvider = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Provider not found" });
    if (user.role !== "provider") return res.status(400).json({ message: "User is not a provider" });

    user.isActive = false;
    user.deactivationReason = reason || "Provider registration rejected";
    await user.save();

    await AuditLog.log({
      userId: req.user._id,
      action: "PROVIDER_REJECTED",
      targetType: "User",
      targetId: user._id,
      description: `Provider ${user.email} rejected. Reason: ${reason || 'Not specified'}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: "Provider rejected", data: user });
  } catch (error) {
    console.error("Reject provider error:", error);
    res.status(500).json({ message: "Error rejecting provider" });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { userId, action, page = 1, limit = 50 } = req.query;
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;

    const logs = await AuditLog.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);
    res.json({ logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
};

exports.getUserStatistics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const activeUsers = await User.countDocuments({ isActive: true, isDeleted: false });
    const inactiveUsers = await User.countDocuments({ isActive: false, isDeleted: false });
    const parents = await User.countDocuments({ role: "parent", isDeleted: false });
    const providers = await User.countDocuments({ role: "provider", isDeleted: false });
    const admins = await User.countDocuments({ role: "admin", isDeleted: false });
    const pendingProviders = await User.countDocuments({ role: "provider", isApproved: false, isDeleted: false });
    const lockedUsers = await User.countDocuments({ lockedUntil: { $gt: new Date() }, isDeleted: false });

    res.json({
      total: totalUsers, active: activeUsers, inactive: inactiveUsers,
      byRole: { parents, providers, admins }, pendingProviders, lockedUsers,
    });
  } catch (error) {
    console.error("Get user statistics error:", error);
    res.status(500).json({ message: "Error fetching user statistics" });
  }
};

// ==================== SYSTEM CONFIGURATION MANAGEMENT ====================

exports.getAllConfigs = async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};
    const configs = await SystemConfig.find(query).sort({ category: 1, key: 1 });
    res.json(configs);
  } catch (error) {
    console.error("Get configs error:", error);
    res.status(500).json({ message: "Error fetching configurations" });
  }
};

exports.getConfigByKey = async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ key: req.params.key });
    if (!config) return res.status(404).json({ message: "Configuration not found" });
    res.json(config);
  } catch (error) {
    console.error("Get config error:", error);
    res.status(500).json({ message: "Error fetching configuration" });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const updateData = { value, updatedBy: req.user._id };
    if (description !== undefined) updateData.description = description;

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      updateData,
      { new: true, upsert: true }
    );

    await AuditLog.log({
      userId: req.user._id,
      action: "CONFIG_UPDATED",
      targetType: "Config",
      targetId: config._id,
      description: `Configuration ${key} updated`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: { key, value },
    });

    res.json({ message: "Configuration updated successfully", data: config });
  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({ message: "Error updating configuration" });
  }
};

exports.initializeConfigs = async (req, res) => {
  try {
    await SystemConfig.initializeDefaults();
    res.json({ message: "Default configurations initialized" });
  } catch (error) {
    console.error("Initialize configs error:", error);
    res.status(500).json({ message: "Error initializing configurations" });
  }
};

// ==================== VACCINATION HEATMAP APIs ====================

exports.getVaccinationHeatmap = async (req, res) => {
  try {
    const heatmapData = await Vaccination.aggregate([
      { $lookup: { from: "children", localField: "childId", foreignField: "_id", as: "child" } },
      { $unwind: "$child" },
      {
        $group: {
          _id: "$child.region",
          totalVaccines: { $sum: 1 },
          completedVaccines: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          pendingVaccines: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          overdueVaccines: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } }
        }
      },
      {
        $project: {
          region: "$_id", _id: 0, totalVaccines: 1, completedVaccines: 1, pendingVaccines: 1, overdueVaccines: 1,
          coverageRate: { $multiply: [{ $divide: ["$completedVaccines", "$totalVaccines"] }, 100] }
        }
      },
      { $sort: { coverageRate: 1 } }
    ]);
    res.json(heatmapData);
  } catch (error) {
    console.error("Heatmap error:", error);
    res.status(500).json({ message: "Error fetching heatmap data" });
  }
};

exports.getRiskHeatmap = async (req, res) => {
  try {
    const riskData = await Child.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$region",
          totalChildren: { $sum: 1 },
          highRiskCount: { $sum: { $cond: [{ $gte: ["$riskScore", 70] }, 1, 0] } },
          mediumRiskCount: { $sum: { $cond: [{ $and: [{ $gte: ["$riskScore", 40] }, { $lt: ["$riskScore", 70] }] }, 1, 0] } },
          lowRiskCount: { $sum: { $cond: [{ $lt: ["$riskScore", 40] }, 1, 0] } },
          avgRiskScore: { $avg: "$riskScore" }
        }
      },
      {
        $project: {
          region: "$_id", _id: 0, totalChildren: 1, highRiskCount: 1, mediumRiskCount: 1, lowRiskCount: 1,
          avgRiskScore: { $round: ["$avgRiskScore", 2] },
          riskPercentage: { $multiply: [{ $divide: ["$highRiskCount", "$totalChildren"] }, 100] }
        }
      },
      { $sort: { riskPercentage: -1 } }
    ]);
    res.json(riskData);
  } catch (error) {
    console.error("Risk heatmap error:", error);
    res.status(500).json({ message: "Error fetching risk heatmap data" });
  }
};

module.exports = exports;
