const AuditLog = require("../models/AuditLog");

/**
 * Audit Log Controller
 * Provides admin access to view and manage audit logs
 */

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of audit logs
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { userId, action, targetType, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};
    
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
};

/**
 * @swagger
 * /api/admin/audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit statistics
 */
exports.getAuditStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
      totalLogs,
      loginAttempts,
      failedAttempts,
      uniqueUsers,
      actionCounts,
    ] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: startDate } }),
      AuditLog.countDocuments({ action: "LOGIN", createdAt: { $gte: startDate } }),
      AuditLog.countDocuments({ status: "FAILED", createdAt: { $gte: startDate } }),
      AuditLog.distinct("userId", { createdAt: { $gte: startDate } }),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      period: { days: parseInt(days), startDate },
      totalLogs,
      loginAttempts,
      failedAttempts,
      uniqueUsers: uniqueUsers.length,
      actionBreakdown: actionCounts,
    });
  } catch (error) {
    console.error("Get audit stats error:", error);
    res.status(500).json({ message: "Error fetching audit statistics" });
  }
};

/**
 * @swagger
 * /api/admin/audit-logs/:id:
 *   get:
 *     summary: Get single audit log
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
 *         description: Audit log details
 */
exports.getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate("userId", "name email role");

    if (!log) {
      return res.status(404).json({ message: "Audit log not found" });
    }

    res.json(log);
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ message: "Error fetching audit log" });
  }
};

module.exports = exports;
