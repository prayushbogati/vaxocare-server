const cron = require("node-cron");
const Vaccination = require("../models/Vaccination");
const Child = require("../models/Child");
const User = require("../models/User");
const { sendReminderEmail } = require("./emailService");
const nodemailer = require("nodemailer");

// transporter singleton (lazy-init)
let transporter;
function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

// simple HTML escaping helper to prevent injection
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const {
  buildPriorityQueue,
  getQueueStats,
  processPriorityQueue,
  getNextPriorityReminders,
  getCriticalChildren,
  calculatePriorityScore,
} = require("./reminderPriorityQueue");

/**
 * Reminder Service with AI-Driven Priority Queue
 *
 * Features:
 * - Cron-based daily scheduler
 * - AI-driven priority scoring
 * - Urgency level classification (CRITICAL, HIGH, MEDIUM, LOW)
 * - Rate limiting and batch processing
 * - Critical vaccine detection
 * - Risk-based prioritization
 */

const startReminderService = () => {
  console.log("AI-Driven Reminder service started");

  // Run every day at 9 AM - Standard reminder batch
  cron.schedule("0 9 * * *", async () => {
    console.log("Running daily AI-driven reminder check...");
    await runDailyReminderCycle();
  });

  // Run every 6 hours to catch critical cases
  cron.schedule("0 */6 * * *", async () => {
    console.log("Running 6-hour critical check...");
    await checkCriticalReminders();
  });

  // Run at startup to catch any immediate reminders
  setTimeout(() => {
    runDailyReminderCycle().catch(console.error);
  }, 10000);
};

/**
 * Run daily reminder cycle with AI prioritization
 */
const runDailyReminderCycle = async () => {
  try {
    console.log("=== Starting Daily AI-Driven Reminder Cycle ===");

    // First, update all priority scores
    await updateAllPriorityScores();

    // Get queue statistics
    const stats = await getQueueStats(7);
    console.log("Queue Statistics:", stats);

    // Process priority queue with AI-driven order
    const result = await processPriorityQueue({
      maxReminders: 50,
      batchSize: 10,
      delayBetweenBatches: 60000,
      sendFunction: async (parent, child, vaccination, priority) => {
        // Enhanced email with priority information
        return await sendPriorityReminderEmail(
          parent,
          child,
          priority, // Now group object
        );
      },
    });

    console.log("Daily reminder cycle complete:", result);
    console.log("=== Daily Reminder Cycle Complete ===");

    return result;
  } catch (error) {
    console.error("Error in daily reminder cycle:", error);
  }
};

/**
 * Check and send critical reminders (more frequent)
 */
const checkCriticalReminders = async () => {
  try {
    // Get critical children requiring immediate attention
    const criticalChildren = await getCriticalChildren();

    if (criticalChildren.length > 0) {
      console.log(
        `Found ${criticalChildren.length} critical cases requiring immediate attention`,
      );

      // Process only critical cases
      for (const item of criticalChildren.slice(0, 20)) {
        await sendCriticalReminder(item);
      }
    }

    return { checked: true, criticalCount: criticalChildren.length };
  } catch (error) {
    console.error("Error checking critical reminders:", error);
  }
};

/**
 * Send critical reminder with enhanced urgency
 */
const sendCriticalReminder = async (priorityItem) => {
  try {
    const vaccination = await Vaccination.findById(priorityItem.vaccinationId);
    if (!vaccination) return;

    const child = await Child.findById(priorityItem.childId).populate(
      "parentId",
      "email name phone",
    );
    if (!child || !child.parentId) return;

    const parent = child.parentId;

    // Send critical email first, then update counters if it succeeds
    const result = await sendPriorityReminderEmail(
      parent,
      child,
      priorityItem, // Now group object
      true, // isCritical
    );

    if (result && result.success) {
      vaccination.reminderCount = (vaccination.reminderCount || 0) + 1;
      vaccination.lastReminderDate = new Date();
      await vaccination.save();
      console.log(
        `Critical reminder sent for ${child.name} - ${vaccination.vaccineName}`,
      );
    } else {
      console.error(
        `Failed to send critical reminder for ${child.name} - ${vaccination.vaccineName}`,
        result || "unknown error",
      );
    }

    return result;
  } catch (error) {
    console.error("Error sending critical reminder:", error);
  }
};

/**
 * Enhanced reminder email with AI priority information
 */
const sendPriorityReminderEmail = async (
  parent,
  child,
  priorityGroup,
  isCritical = false,
) => {
  // defensive: ensure we have a priority object
  if (!priority) {
    priority = {
      urgencyLevel: "NORMAL",
      riskScore: 0,
      daysOverdue: 0,
      daysUntilDue: 0,
      recommendation: [],
      priorityScore: 0,
    };
  }
  try {
    const urgencyBadge = isCritical
      ? "🔴 URGENT"
      : getUrgencyEmoji(priority.urgencyLevel);

    // Handle both single vaccination (backwards compat) and group
    const vaccinations = priorityGroup.vaccinations || [priorityGroup];
    const groupPriority = priorityGroup;
    
    const vaccinesList = vaccinations.map(v => escapeHtml(v.vaccineName)).join(', ');
    const numVaccines = vaccinations.length;
    
    const subject = isCritical
      ? `🚨 URGENT: ${numVaccines} vaccine${numVaccines > 1 ? 's' : ''} for ${child.name} - Week ${groupPriority.reminderWeek}`
      : `${urgencyBadge} ${numVaccines} Vaccine${numVaccines > 1 ? 's' : ''} Reminder - Week ${groupPriority.reminderWeek} for ${child.name}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${isCritical ? '<div style="background-color: #dc2626; color: white; padding: 10px; text-align: center; font-weight: bold;">⚠️ URGENT ACTION REQUIRED - Multiple Vaccines Due</div>' : ""}
        
        <h2 style="color: #2563eb;">Vaxocare Vaccination Reminder</h2>
        
        <div style="background-color: ${getUrgencyColor(groupPriority.urgencyLevel)}; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Priority Level:</strong> ${escapeHtml(String(groupPriority.urgencyLevel))}</p>
          <p style="margin: 5px 0;"><strong>Risk Score:</strong> ${escapeHtml(String(groupPriority.riskScore))}%</p>
          <p style="margin: 5px 0;"><strong>Week Group:</strong> Week ${escapeHtml(String(groupPriority.reminderWeek))}</p>
          ${groupPriority.minDaysUntilDue < 0 ? `<p style="margin: 5px 0; color: #dc2626;"><strong>⚠️ ${Math.abs(groupPriority.minDaysUntilDue)} days overdue!</strong></p>` : ""}
        </div>
        
        <p>Dear Parent,</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 8px 0;"><strong>Child Name:</strong> ${escapeHtml(child.name)}</p>
          <p style="margin: 8px 0;"><strong><strong>${numVaccines} Vaccine${numVaccines > 1 ? 's Due This Week' : ' Due'}:</strong></p>
          <ul style="margin: 8px 0;">
            ${vaccinations.map(v => `<li>${escapeHtml(v.vaccineName)} - ${v.dueDate ? escapeHtml(v.dueDate.toDateString()) : 'N/A'}</li>`).join('')}
          </ul>
          <p style="margin: 8px 0;"><strong>Days Until:</strong> ${escapeHtml(String(groupPriority.minDaysUntilDue || 0))}</p>
        </div>
        
        ${
          groupPriority.recommendation && groupPriority.recommendation.length > 0
            ? `
        <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">Recommended Actions:</h3>
          <ul>
            ${groupPriority.recommendation.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
          </ul>
        </div>
        `
            : ""
        }
        <p>✅ <strong>Book ONE appointment for all listed vaccines.</strong></p>
        <p>Please schedule at your nearest vaccination center as soon as possible.</p>
        
        <p style="color: #dc2626; font-weight: bold;">⚠️ Complete all vaccines in this group together when possible.</p>
        
        <p>Regards,<br>Vaxocare Team</p>
        
        <hr style="margin-top: 20px; border: none; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280;">
          Vaxocare Smart Vaccination Management System | Group Reminder #${escapeHtml(String((vaccinations[0]?.reminderCount || 0) + 1))}
          | Group Priority: ${escapeHtml(String(groupPriority.priorityScore))}
        </p>
      </div>
    `;

    // Use existing email service
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("Email not configured. Logging priority reminder instead:");
      console.log({
        parent: parent.email,
        child: child.name,
        vaccine: vaccination.vaccineName,
        priority: priority,
      });
      return { success: false, message: "Email not configured" };
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: parent.email,
      subject: subject,
      html: htmlContent,
    };

    const info = await getTransport().sendMail(mailOptions);
    console.log(`Priority reminder sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending priority email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get urgency emoji
 */
const getUrgencyEmoji = (urgencyLevel) => {
  switch (urgencyLevel) {
    case "CRITICAL":
      return "🔴 CRITICAL";
    case "HIGH":
      return "🟠 HIGH";
    case "MEDIUM":
      return "🟡 MEDIUM";
    case "LOW":
      return "🟢 LOW";
    default:
      return "⚪ NORMAL";
  }
};

/**
 * Get urgency color
 */
const getUrgencyColor = (urgencyLevel) => {
  switch (urgencyLevel) {
    case "CRITICAL":
      return "#fee2e2";
    case "HIGH":
      return "#ffedd5";
    case "MEDIUM":
      return "#fef3c7";
    case "LOW":
      return "#dcfce7";
    default:
      return "#f3f4f6";
  }
};

/**
 * Update all priority scores in the system
 * Run this before sending reminders to ensure fresh priorities
 */
const updateAllPriorityScores = async () => {
  try {
    console.log("Updating priority scores for all pending vaccinations...");

    const pendingVaccinations = await Vaccination.find({
      status: { $in: ["pending", "overdue"] },
    }).populate({
      path: "childId",
      select: "name parentId riskScore",
    });

    let updated = 0;

    for (const vaccination of pendingVaccinations) {
      if (!vaccination.childId) continue;

      const priority = await calculatePriorityScore({
        vaccination,
        child: vaccination.childId,
        reminderCount: vaccination.reminderCount || 0,
      });

      vaccination.priorityScore = priority.priorityScore;
      vaccination.urgencyLevel = priority.urgencyLevel;
      vaccination.isCriticalVaccine = priority.isCriticalVaccine;

      await vaccination.save();
      updated++;
    }

    console.log(`Updated priority scores for ${updated} vaccinations`);
    return updated;
  } catch (error) {
    console.error("Error updating priority scores:", error);
  }
};

/**
 * Check for overdue vaccinations and update status
 */
const checkOverdueVaccinations = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find vaccinations that are past due date and still pending
    const overdueVaccinations = await Vaccination.find({
      status: "pending",
      dueDate: { $lt: today },
    });

    console.log(`Found ${overdueVaccinations.length} overdue vaccinations`);

    // Update status to overdue
    for (const vaccination of overdueVaccinations) {
      vaccination.status = "overdue";
      await vaccination.save();

      // Update priority scores
      await updateVaccinationPriority(vaccination._id);
    }

    console.log("Overdue check complete");
    return overdueVaccinations.length;
  } catch (error) {
    console.error("Error checking overdue vaccinations:", error);
  }
};

/**
 * Update single vaccination priority
 */
const updateVaccinationPriority = async (vaccinationId) => {
  try {
    const vaccination = await Vaccination.findById(vaccinationId).populate(
      "childId",
      "name riskScore",
    );
    if (!vaccination || !vaccination.childId) return;

    const priority = await calculatePriorityScore({
      vaccination,
      child: vaccination.childId,
      reminderCount: vaccination.reminderCount || 0,
    });

    vaccination.priorityScore = priority.priorityScore;
    vaccination.urgencyLevel = priority.urgencyLevel;
    vaccination.isCriticalVaccine = priority.isCriticalVaccine;

    await vaccination.save();

    return priority;
  } catch (error) {
    console.error("Error updating vaccination priority:", error);
  }
};

/**
 * Legacy function - backward compatibility
 */
const checkUpcomingVaccinations = async () => {
  // Use the new AI-driven process
  return await runDailyReminderCycle();
};

/**
 * Get reminder queue status (for admin dashboard)
 */
const getReminderQueueStatus = async () => {
  try {
    const stats = await getQueueStats(7);
    const critical = await getCriticalChildren();
    const nextReminders = await getNextPriorityReminders(5);

    return {
      ...stats,
      nextReminders,
      criticalChildren: critical.length,
    };
  } catch (error) {
    console.error("Error getting reminder queue status:", error);
  }
};

module.exports = {
  startReminderService,
  checkUpcomingVaccinations,
  checkOverdueVaccinations,
  runDailyReminderCycle,
  checkCriticalReminders,
  getReminderQueueStatus,
  updateAllPriorityScores,
  updateVaccinationPriority,
};
