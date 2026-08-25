/**
 * AI-Driven Priority Queue for Reminders
 *
 * This module implements an intelligent reminder prioritization system that:
 * - Calculates priority scores using multiple factors
 * - Uses logistic regression for risk assessment
 * - Prioritizes high-risk children and overdue vaccinations
 * - Implements urgency scoring based on due dates
 * - Considers vaccine importance factors
 */

const Vaccination = require("../models/Vaccination");
const Child = require("../models/Child");
const { calculateRiskProbability, getRiskLevel } = require("../ai/riskModel");
const vaccineSchedule = require("../utils/vaccineSchedule");


function getVaccineWeeks(vaccineName) {
  const entry = vaccineSchedule.find(v => v.name === vaccineName);
  return entry ? entry.weeks : 0;
}


// Priority weights for different factors
const PRIORITY_WEIGHTS = {
  overdueDays: 10, // Weight for days overdue
  riskScore: 5, // Weight for child's risk score
  daysUntilDue: -8, // Negative weight - closer to due = higher priority
  vaccineImportance: 3, // Weight for vaccine type importance
  missedAppointment: 15, // Weight for missed appointments
  previousReminder: -2, // Negative weight if already reminded
};

// Critical vaccines that need immediate attention
const CRITICAL_VACCINES = [
  "BCG",
  "OPV 0",
  "Hepatitis B",
  "Measles/Rubella",
  "DPT 1",
  "DPT 2",
  "DPT 3",
];

// Vaccine importance scores (1-10)
const VACCINE_IMPORTANCE = {
  BCG: 10,
  "OPV 0": 10,
  "Hepatitis B": 10,
  "DPT 1": 9,
  "DPT 2": 9,
  "DPT 3": 9,
  "Pentavalent 1": 8,
  "Pentavalent 2": 8,
  "Pentavalent 3": 8,
  "OPV 1": 8,
  "OPV 2": 8,
  "OPV 3": 8,
  "PCV 1": 7,
  "PCV 2": 7,
  "PCV 3": 7,
  "Rota 1": 6,
  "Rota 2": 6,
  IPV: 7,
  "Measles/Rubella": 10,
  "Measles/Rubella 2": 10,
  "Japanese Encephalitis": 7,
  "Vitamin A": 5,
  "Vitamin A (2nd dose)": 5,
  "DPT Booster 1": 6,
  "DPT Booster 2": 6,
  "OPV Booster": 6,
};

/**
 * Calculate priority score for a reminder
 * Higher score = higher priority to send reminder
 *
 * @param {Object} reminderData - Reminder data including vaccination and child info
 * @returns {Object} Priority result with score and details
 */
const calculatePriorityScore = async (reminderData) => {
  const {
    vaccination,
    child,
    reminderCount = 0,
    overdueCount = null,
  } = reminderData;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(vaccination.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  // Calculate days until due (negative if overdue)
  const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

  // Calculate days overdue (positive if overdue)
  const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

  // Get child's AI risk probability
  const riskScore = child.riskScore || 0;

  // Check if this is a critical vaccine
  const isCriticalVaccine = CRITICAL_VACCINES.includes(vaccination.vaccineName);
  const vaccineImportance = VACCINE_IMPORTANCE[vaccination.vaccineName] || 5;

  // determine overdue count (may be provided by caller to avoid extra query)
  let effectiveOverdue = overdueCount;
  if (effectiveOverdue === null) {
    effectiveOverdue = await Vaccination.countDocuments({
      childId: child._id,
      status: "overdue",
    });
  }

  // Calculate priority components
  const overdueScore = daysOverdue * PRIORITY_WEIGHTS.overdueDays;
  const riskScoreScore = (riskScore / 100) * PRIORITY_WEIGHTS.riskScore * 100;
  const urgencyScore =
    daysUntilDue > 0
      ? (14 - daysUntilDue) * Math.abs(PRIORITY_WEIGHTS.daysUntilDue) // Closer to due = higher
      : daysOverdue * 20; // Overdue = very urgent
  const vaccineScore =
    (isCriticalVaccine ? 20 : 0) +
    vaccineImportance * PRIORITY_WEIGHTS.vaccineImportance;
  const missedScore = effectiveOverdue * PRIORITY_WEIGHTS.missedAppointment;
  const reminderPenalty = reminderCount * PRIORITY_WEIGHTS.previousReminder;

  // Calculate total priority score
  const totalScore = Math.max(
    0,
    overdueScore +
      riskScoreScore +
      urgencyScore +
      vaccineScore +
      missedScore +
      reminderPenalty,
  );

  // Determine urgency level
  let urgencyLevel;
  if (daysOverdue > 7 || riskScore > 70) {
    urgencyLevel = "CRITICAL";
  } else if (daysOverdue > 3 || riskScore > 50 || daysUntilDue <= 1) {
    urgencyLevel = "HIGH";
  } else if (daysOverdue > 0 || riskScore > 30 || daysUntilDue <= 3) {
    urgencyLevel = "MEDIUM";
  } else {
    urgencyLevel = "LOW";
  }

  // Generate recommendation
  const recommendation = generatePriorityRecommendation(
    urgencyLevel,
    daysOverdue,
    riskScore,
    isCriticalVaccine,
  );

  return {
    vaccinationId: vaccination._id,
    childId: child._id,
    childName: child.name,
    vaccineName: vaccination.vaccineName,
    dueDate: vaccination.dueDate,
    daysUntilDue,
    daysOverdue,
    riskScore,
    urgencyLevel,
    priorityScore: Math.round(totalScore),
    isCriticalVaccine,
    overdueCount,
    reminderCount,
    recommendation,
  };
};

/**
 * Generate recommendation based on priority factors
 */
const generatePriorityRecommendation = (
  urgencyLevel,
  daysOverdue,
  riskScore,
  isCriticalVaccine,
) => {
  const recommendations = [];

  if (urgencyLevel === "CRITICAL") {
    recommendations.push("URGENT: Immediate phone call required");
    recommendations.push("Consider home visit if no response");
    if (isCriticalVaccine) {
      recommendations.push(
        "Critical vaccine - escalate to healthcare provider",
      );
    }
  } else if (urgencyLevel === "HIGH") {
    recommendations.push("Send priority SMS + Email");
    recommendations.push("Schedule callback if no response within 24 hours");
    if (daysOverdue > 0) {
      recommendations.push(
        `${daysOverdue} days overdue - schedule catch-up immediately`,
      );
    }
  } else if (urgencyLevel === "MEDIUM") {
    recommendations.push("Send standard email reminder");
    recommendations.push("Monitor for response");
  } else {
    recommendations.push("Send regular reminder");
  }

  if (riskScore > 70) {
    recommendations.push(`High risk child (${riskScore}%) - prioritize`);
  }

  return recommendations;
};

/**
 * Build AI-driven priority queue from pending vaccinations
 * Returns sorted array with highest priority first
 *
 * @param {number} daysAhead - Number of days ahead to look for reminders
 * @returns {Array} Sorted priority queue
 */
const buildPriorityQueue = async (daysAhead = 7) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Get all pending vaccinations that are due or overdue WITH vaccine details
    const pendingVaccinations = await Vaccination.find({
      status: { $in: ["pending", "overdue"] },
      dueDate: { $lte: futureDate },
    }).populate({
      path: "childId",
      select: "name parentId riskScore dateOfBirth",
      populate: {
        path: "parentId",
        select: "email name phone",
      },
    });

    console.log(
      `Building priority queue from ${pendingVaccinations.length} pending vaccinations...`,
    );

    // Group by childId + reminderWeek (weeksAfterBirth - 1)
    const weekGroups = new Map(); // childId_reminderWeek -> {vaccinations: [], child, minDueDate, avgPriority}
    
    for (const vaccination of pendingVaccinations) {
      if (!vaccination.childId || !vaccination.vaccineName) continue;
      
      const reminderWeek = getVaccineWeeks(vaccination.vaccineName) - 1;
      const groupKey = `${vaccination.childId._id}_${reminderWeek}`;
      
      if (!weekGroups.has(groupKey)) {
        weekGroups.set(groupKey, {
          childId: vaccination.childId._id,
          reminderWeek,
          child: vaccination.childId,
          vaccinations: [],
          minDaysUntilDue: Infinity,
          totalPriority: 0,
          count: 0
        });
      }
      
      const group = weekGroups.get(groupKey);
      group.vaccinations.push(vaccination);
      
      // Track min due date for group priority
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(vaccination.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
      group.minDaysUntilDue = Math.min(group.minDaysUntilDue, daysUntilDue);
      
      group.count++;
    }

    // Per child: select only nearest reminder week group
    const childBestGroups = new Map(); // childId -> best week group
    for (const [key, group] of weekGroups) {
      const currentKey = key;
      const childIdStr = group.childId.toString();
      const existing = childBestGroups.get(childIdStr);
      
      if (!existing || group.minDaysUntilDue < existing.minDaysUntilDue) {
        childBestGroups.set(childIdStr, group);
      }
    }

    // Calculate final priority for each child group and flatten
    const priorityQueue = [];
    for (const [groupKey, group] of childBestGroups.entries()) {
      // Calculate group priority (avg of all vaccines + week bonus)
      const avgDaysUntilDue = group.minDaysUntilDue;
      
      // Calculate individual priorities for scoring
      const individualPriorities = await Promise.all(
        group.vaccinations.map(async (vacc) => {
          const priority = await calculatePriorityScore({
            vaccination: vacc,
            child: group.child,
            reminderCount: vacc.reminderCount || 0,
            overdueCount: 0, // group level
          });
          return priority.priorityScore;
        })
      );
      
      const avgPriority = individualPriorities.reduce((a, b) => a + b, 0) / group.vaccinations.length;
      const weekBonus = Math.max(0, 10 - Math.abs(group.reminderWeek - Math.floor((new Date() - group.child.dateOfBirth) / (7*24*60*60*1000))));
      
      const groupPriorityItem = {
        groupKey: groupKey,
        childId: group.childId,
        childName: group.child.name,
        reminderWeek: group.reminderWeek,
        vaccines: group.vaccinations.map(v => v.vaccineName),
        numVaccines: group.vaccinations.length,
        minDaysUntilDue: avgDaysUntilDue,
        avgPriorityScore: Math.round(avgPriority),
        priorityScore: Math.round(avgPriority + weekBonus * 100),
        urgencyLevel: avgDaysUntilDue <= 0 ? 'CRITICAL' : 'HIGH',
        vaccinations: group.vaccinations, // for processing
        parent: group.child.parentId
      };
      
      priorityQueue.push(groupPriorityItem);
    }

    // Sort by group priority (descending)
    const sortedQueue = priorityQueue.sort((a, b) => b.priorityScore - a.priorityScore);

    console.log(`Priority Queue Built (${childBestGroups.size} unique children):`);
    console.log(`  - Critical: ${sortedQueue.filter(q => q.urgencyLevel === 'CRITICAL').length}`);
    console.log(`  - Bundles with 5+ vaccines: ${sortedQueue.filter(q => q.numVaccines >= 5).length}`);

    // Log queue statistics
    const criticalCount = sortedQueue.filter(
      (q) => q.urgencyLevel === "CRITICAL",
    ).length;
    const highCount = sortedQueue.filter(
      (q) => q.urgencyLevel === "HIGH",
    ).length;
    const mediumCount = sortedQueue.filter(
      (q) => q.urgencyLevel === "MEDIUM",
    ).length;

    console.log(`Priority Queue Built:`);
    console.log(`  - Critical: ${criticalCount}`);
    console.log(`  - High: ${highCount}`);
    console.log(`  - Medium: ${mediumCount}`);
    console.log(
      `  - Low: ${sortedQueue.length - criticalCount - highCount - mediumCount}`,
    );

    return sortedQueue;
  } catch (error) {
    console.error("Error building priority queue:", error);
    throw error;
  }
};

/**
 * Get queue statistics
 */
const getQueueStats = async (daysAhead = 7) => {
  const queue = await buildPriorityQueue(daysAhead);

  return {
    totalReminders: queue.length,
    byUrgency: {
      CRITICAL: queue.filter((q) => q.urgencyLevel === "CRITICAL").length,
      HIGH: queue.filter((q) => q.urgencyLevel === "HIGH").length,
      MEDIUM: queue.filter((q) => q.urgencyLevel === "MEDIUM").length,
      LOW: queue.filter((q) => q.urgencyLevel === "LOW").length,
    },
    criticalVaccines: queue.filter((q) => q.isCriticalVaccine).length,
    overdueCount: queue.filter((q) => q.daysOverdue > 0).length,
    highRiskChildren: queue.filter((q) => q.riskScore > 70).length,
    averagePriorityScore:
      queue.length > 0
        ? Math.round(
            queue.reduce((sum, q) => sum + q.priorityScore, 0) / queue.length,
          )
        : 0,
  };
};

/**
 * Process priority queue and send reminders
 * Processes in order of priority, with rate limiting between sends
 *
 * @param {Object} options - Processing options
 * @returns {Object} Processing results
 */
const processPriorityQueue = async (options = {}) => {
  const {
    maxReminders = 50, // Max reminders to send in one run
    batchSize = 10, // Process in batches
    delayBetweenBatches = 60000, // 1 minute delay between batches
    sendFunction = null, // Custom send function
  } = options;

  try {
    console.log("Starting priority queue processing...");

    // Build the priority queue
    const queue = await buildPriorityQueue(7);

    if (queue.length === 0) {
      console.log("No reminders to process");
      return { processed: 0, success: 0, failed: 0 };
    }

    // Track results
    let processed = 0;
    let success = 0;
    let failed = 0;
    const results = [];

    // Process up to maxReminders
    const toProcess = queue.slice(0, maxReminders);

    const LOCK_TTL = 5 * 60 * 1000; // 5 minutes

    for (let i = 0; i < toProcess.length; i++) {
      const groupPriority = toProcess[i];

      // For groups, use childId lock (daily reminder sent flag)
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const groupLockKey = `group_reminder_${groupPriority.childId}_${todayKey}`;
      
      // Simple in-memory lock for now (add Redis later if needed)
      if (global.groupLocks && global.groupLocks.has(groupLockKey)) {
        console.log(`Group already processed today: ${groupPriority.childName}`);
        continue;
      }
      
      if (!global.groupLocks) global.groupLocks = new Set();
      global.groupLocks.add(groupLockKey);

      // Get child and parent (already in group)
      const child = groupPriority.child;
      const parent = groupPriority.parent || child.parentId;
      
      if (!child || !parent) {
        continue;
      }

      // Send bundled reminder
      let sendResult;
      try {
        if (sendFunction) {
          sendResult = await sendFunction(parent, child, groupPriority);
        } else {
          // Use bundled email service
          const reminderService = require("./reminderService");
          sendResult = await reminderService.sendPriorityReminderEmail(
            parent,
            child,
            groupPriority
          );
        }
      } catch (err) {
        console.error("Error sending group reminder:", err);
        sendResult = { success: false, error: err.message };
      }

      if (sendResult && sendResult.success) {
        // Update ALL vaccinations in group
        const updatePromises = groupPriority.vaccinations.map(async (vacc) => {
          vacc.reminderCount = (vacc.reminderCount || 0) + 1;
          vacc.lastReminderDate = new Date();
          return vacc.save();
        });
        await Promise.all(updatePromises);
        await updateChildRiskScore(child._id);
        success++;
      } else {
        failed++;
      }

      processed++;

      results.push({
        childName: groupPriority.childName,
        weekGroup: groupPriority.reminderWeek,
        numVaccines: groupPriority.numVaccines,
        vaccines: groupPriority.vaccines,
        priorityScore: groupPriority.priorityScore,
        urgencyLevel: groupPriority.urgencyLevel,
        sent: !!(sendResult && sendResult.success),
      });


      // Log progress
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${toProcess.length} reminders...`);
      }

      // Rate limiting - small delay between each send
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Batch delay
      if (processed % batchSize === 0 && processed < toProcess.length) {
        console.log(
          `Batch complete. Waiting ${delayBetweenBatches / 1000}s before next batch...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches),
        );
      }
    }

    console.log(`Priority queue processing complete:`);
    console.log(`  - Total processed: ${processed}`);
    console.log(`  - Successful: ${success}`);
    console.log(`  - Failed: ${failed}`);

    return {
      processed,
      success,
      failed,
      results,
    };
  } catch (error) {
    console.error("Error processing priority queue:", error);
    return { processed: 0, success: 0, failed: 0, error: error.message };
  }
};

/**
 * Update child's risk score using AI model
 */
const updateChildRiskScore = async (childId) => {
  try {
    const child = await Child.findById(childId);
    if (!child) return;

    const totalVaccines = await Vaccination.countDocuments({ childId });
    const completed = await Vaccination.countDocuments({
      childId,
      status: "completed",
    });
    const overdue = await Vaccination.countDocuments({
      childId,
      status: "overdue",
    });

    // compute missed appointments separately (reminders sent but not completed)
    const missedAppointments = await Vaccination.countDocuments({
      childId,
      reminderCount: { $gt: 0 },
      status: { $ne: "completed" },
    });

    // Calculate completion rate
    const completionRate =
      totalVaccines > 0 ? (completed / totalVaccines) * 100 : 0;

    // Get days since last vaccination
    const lastVaccination = await Vaccination.findOne({
      childId,
      status: "completed",
    }).sort({ completedDate: -1 });

    const daysSinceLast = lastVaccination?.completedDate
      ? Math.floor(
          (new Date() - lastVaccination.completedDate) / (1000 * 60 * 60 * 24),
        )
      : 30;

    // Use AI model for risk calculation
    const probability = calculateRiskProbability({
      overdueCount: overdue,
      missedAppointments,
      daysSinceLast,
      completionRate,
    });

    const riskScore = Math.round(probability * 100);

    child.riskScore = riskScore;
    await child.save();

    return riskScore;
  } catch (error) {
    console.error("Error updating child risk score:", error);
  }
};

/**
 * Get next priority reminder without sending
 * Useful for preview/display purposes
 */
const getNextPriorityReminders = async (limit = 10) => {
  const queue = await buildPriorityQueue(7);
  return queue.slice(0, limit);
};

/**
 * Get children requiring immediate attention (for admin alerts)
 */
const getCriticalChildren = async () => {
  const queue = await buildPriorityQueue(14);

  // Filter for critical items
  const critical = queue.filter(
    (q) =>
      q.urgencyLevel === "CRITICAL" || q.riskScore > 80 || q.daysOverdue > 14,
  );

  return critical;
};

module.exports = {
  calculatePriorityScore,
  buildPriorityQueue,
  getQueueStats,
  processPriorityQueue,
  getNextPriorityReminders,
  getCriticalChildren,
  updateChildRiskScore,
  PRIORITY_WEIGHTS,
  CRITICAL_VACCINES,
  VACCINE_IMPORTANCE,
};
