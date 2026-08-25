const exportService = require("../services/exportService");

/**
 * @swagger
 * /api/admin/export/vaccinations:
 *   get:
 *     summary: Export vaccinations to CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
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
 *     responses:
 *       200:
 *         description: CSV file
 */
exports.exportVaccinations = async (req, res) => {
  try {
    const { status, startDate, endDate, childId, vaccineName } = req.query;
    
    const csv = await exportService.exportVaccinationsCSV({
      status,
      startDate,
      endDate,
      childId,
      vaccineName,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=vaccinations_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export vaccinations error:", error);
    res.status(500).json({ message: "Error exporting vaccinations" });
  }
};

/**
 * @swagger
 * /api/admin/export/children:
 *   get:
 *     summary: Export children to CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 */
exports.exportChildren = async (req, res) => {
  try {
    const { riskLevel, isActive } = req.query;
    
    const csv = await exportService.exportChildrenCSV({
      riskLevel,
      isActive,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=children_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export children error:", error);
    res.status(500).json({ message: "Error exporting children" });
  }
};

/**
 * @swagger
 * /api/admin/export/high-risk:
 *   get:
 *     summary: Export high-risk children report
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 */
exports.exportHighRisk = async (req, res) => {
  try {
    const csv = await exportService.exportHighRiskReportCSV();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=high_risk_children_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export high risk error:", error);
    res.status(500).json({ message: "Error exporting high risk report" });
  }
};

/**
 * @swagger
 * /api/admin/export/audit-logs:
 *   get:
 *     summary: Export audit logs
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
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const { userId, action, startDate, endDate } = req.query;
    
    const csv = await exportService.exportAuditLogsCSV({
      userId,
      action,
      startDate,
      endDate,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=audit_logs_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export audit logs error:", error);
    res.status(500).json({ message: "Error exporting audit logs" });
  }
};

/**
 * @swagger
 * /api/admin/report/monthly:
 *   get:
 *     summary: Generate monthly public health report
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Monthly report
 */
exports.generateMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const report = await exportService.generateMonthlyReport(
      parseInt(month),
      parseInt(year)
    );

    res.json(report);
  } catch (error) {
    console.error("Generate monthly report error:", error);
    res.status(500).json({ message: "Error generating monthly report" });
  }
};

module.exports = exports;
