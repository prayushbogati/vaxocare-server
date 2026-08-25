const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");
const User = require("../models/User");

/**
 * Export Service
 * Generates CSV and PDF reports for vaccination data
 */

// Convert JSON data to CSV string
const jsonToCSV = (data, headers) => {
  const headerRow = headers.map(h => h.label).join(",");
  const rows = data.map(item => {
    return headers.map(h => {
      let value = item[h.key];
      if (value === null || value === undefined) value = "";
      if (typeof value === "string") {
        // Escape quotes and wrap in quotes
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",");
  });
  return [headerRow, ...rows].join("\n");
};

// Export vaccinations to CSV
exports.exportVaccinationsCSV = async (filters = {}) => {
  try {
    const { status, startDate, endDate, childId, vaccineName } = filters;
    
    const query = {};
    if (status) query.status = status;
    if (childId) query.childId = childId;
    if (vaccineName) query.vaccineName = vaccineName;
    if (startDate || endDate) {
      query.completedDate = {};
      if (startDate) query.completedDate.$gte = new Date(startDate);
      if (endDate) query.completedDate.$lte = new Date(endDate);
    }

    const vaccinations = await Vaccination.find(query)
      .populate("childId", "name dateOfBirth parentId")
      .populate("administeredBy", "name")
      .lean();

    const headers = [
      { key: "childId.name", label: "Child Name" },
      { key: "childId.dateOfBirth", label: "Date of Birth" },
      { key: "vaccineName", label: "Vaccine Name" },
      { key: "dueDate", label: "Due Date" },
      { key: "scheduledDate", label: "Scheduled Date" },
      { key: "completedDate", label: "Completed Date" },
      { key: "status", label: "Status" },
      { key: "administeredBy.name", label: "Administered By" },
      { key: "notes", label: "Notes" },
    ];

    // Transform data for CSV
    const transformedData = vaccinations.map(v => ({
      "childId.name": v.childId?.name || "",
      "childId.dateOfBirth": v.childId?.dateOfBirth ? new Date(v.childId.dateOfBirth).toISOString().split('T')[0] : "",
      "vaccineName": v.vaccineName || "",
      "dueDate": v.dueDate ? new Date(v.dueDate).toISOString().split('T')[0] : "",
      "scheduledDate": v.scheduledDate ? new Date(v.scheduledDate).toISOString().split('T')[0] : "",
      "completedDate": v.completedDate ? new Date(v.completedDate).toISOString().split('T')[0] : "",
      "status": v.status || "",
      "administeredBy.name": v.administeredBy?.name || "",
      "notes": v.notes || "",
    }));

    return jsonToCSV(transformedData, headers);
  } catch (error) {
    console.error("Export vaccinations CSV error:", error);
    throw error;
  }
};

// Export children to CSV
exports.exportChildrenCSV = async (filters = {}) => {
  try {
    const { riskLevel, isActive } = filters;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (riskLevel === 'high') query.riskScore = { $gte: 50 };
    else if (riskLevel === 'medium') query.riskScore = { $gte: 30, $lt: 50 };
    else if (riskLevel === 'low') query.riskScore = { $lt: 30 };

    const children = await Child.find(query)
      .populate("parentId", "name email phone")
      .lean();

    const headers = [
      { key: "name", label: "Child Name" },
      { key: "dateOfBirth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "bloodGroup", label: "Blood Group" },
      { key: "riskScore", label: "Risk Score" },
      { key: "parentId.name", label: "Parent Name" },
      { key: "parentId.email", label: "Parent Email" },
      { key: "parentId.phone", label: "Parent Phone" },
    ];

    const transformedData = children.map(c => ({
      name: c.name || "",
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : "",
      gender: c.gender || "",
      bloodGroup: c.bloodGroup || "",
      riskScore: c.riskScore || 0,
      "parentId.name": c.parentId?.name || "",
      "parentId.email": c.parentId?.email || "",
      "parentId.phone": c.parentId?.phone || "",
    }));

    return jsonToCSV(transformedData, headers);
  } catch (error) {
    console.error("Export children CSV error:", error);
    throw error;
  }
};

// Export high-risk children report
exports.exportHighRiskReportCSV = async () => {
  try {
    const children = await Child.find({ riskScore: { $gte: 50 }, isActive: true })
      .populate("parentId", "name email phone")
      .lean();

    const headers = [
      { key: "name", label: "Child Name" },
      { key: "dateOfBirth", label: "Date of Birth" },
      { key: "riskScore", label: "Risk Score" },
      { key: "parentId.name", label: "Parent Name" },
      { key: "parentId.email", label: "Parent Email" },
      { key: "parentId.phone", label: "Parent Phone" },
    ];

    const transformedData = children.map(c => ({
      name: c.name || "",
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : "",
      riskScore: c.riskScore || 0,
      "parentId.name": c.parentId?.name || "",
      "parentId.email": c.parentId?.email || "",
      "parentId.phone": c.parentId?.phone || "",
    }));

    return jsonToCSV(transformedData, headers);
  } catch (error) {
    console.error("Export high risk report CSV error:", error);
    throw error;
  }
};

// Generate monthly public health report
exports.generateMonthlyReport = async (month, year) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [
      totalChildren,
      totalVaccinations,
      completedVaccinations,
      pendingVaccinations,
      overdueVaccinations,
      highRiskChildren,
    ] = await Promise.all([
      Child.countDocuments({ isActive: true }),
      Vaccination.countDocuments(),
      Vaccination.countDocuments({ status: "completed", completedDate: { $gte: startDate, $lte: endDate } }),
      Vaccination.countDocuments({ status: "pending" }),
      Vaccination.countDocuments({ status: "overdue" }),
      Child.countDocuments({ riskScore: { $gte: 50 }, isActive: true }),
    ]);

    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    return {
      reportTitle: `Public Health Report - ${monthNames[month - 1]} ${year}`,
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      summary: {
        totalRegisteredChildren: totalChildren,
        totalVaccinations: totalVaccinations,
        completedThisMonth: completedVaccinations,
        pendingVaccinations,
        overdueVaccinations,
        highRiskChildren,
      },
      completionRate: totalVaccinations > 0 
        ? ((completedVaccinations / totalVaccinations) * 100).toFixed(2) 
        : 0,
    };
  } catch (error) {
    console.error("Generate monthly report error:", error);
    throw error;
  }
};

// Export audit logs
exports.exportAuditLogsCSV = async (filters = {}) => {
  try {
    const { userId, action, startDate, endDate } = filters;
    const AuditLog = require("../models/AuditLog");
    
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    const headers = [
      { key: "createdAt", label: "Timestamp" },
      { key: "userId.name", label: "User Name" },
      { key: "userId.email", label: "User Email" },
      { key: "action", label: "Action" },
      { key: "targetType", label: "Target Type" },
      { key: "description", label: "Description" },
      { key: "ipAddress", label: "IP Address" },
    ];

    const transformedData = logs.map(l => ({
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : "",
      "userId.name": l.userId?.name || "",
      "userId.email": l.userId?.email || "",
      action: l.action || "",
      targetType: l.targetType || "",
      description: l.description || "",
      ipAddress: l.ipAddress || "",
    }));

    return jsonToCSV(transformedData, headers);
  } catch (error) {
    console.error("Export audit logs CSV error:", error);
    throw error;
  }
};

module.exports = exports;
