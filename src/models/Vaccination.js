const mongoose = require("mongoose");

const vaccinationSchema = new mongoose.Schema({
  childId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Child",
    required: true,
  },
  vaccineName: {
    type: String,
    required: [true, "Please provide vaccine name"],
  },
  vaccineCode: {
    type: String,
    default: "",
  },
  dueDate: {
    type: Date,
    required: true,
  },
  scheduledDate: {
    type: Date,
  },
  appointmentTime: {
    type: String, // e.g., "10:30 AM"
  },
  status: {
    type: String,
    enum: ["pending", "completed", "overdue", "cancelled"],
    default: "pending",
  },
  completedDate: {
    type: Date,
  },
  anomalyFlag: {
    type: Boolean,
    default: false,
  },
  anomalyReason: {
    type: String,
    default: "",
  },
  notes: {
    type: String,
    default: "",
  },
  administeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // AI-Driven Reminder Tracking Fields
  reminderCount: {
    type: Number,
    default: 0,
  },
  lastReminderDate: {
    type: Date,
  },
  priorityScore: {
    type: Number,
    default: 0,
  },
  urgencyLevel: {
    type: String,
    enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", ""],
    default: "",
  },
  isCriticalVaccine: {
    type: Boolean,
    default: false,
  },
  // Approval status for appointments
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: {
    type: Date,
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectionReason: {
    type: String,
    default: "",
  },
  // Manual correction fields
  correctionPending: {
    type: Boolean,
    default: false,
  },
  pendingCorrection: {
    status: String,
    notes: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    requestedAt: Date,
  },
  correctionApprovedAt: {
    type: Date,
  },
  correctionApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // Override history
  overrideHistory: {
    type: Map,
    of: String,
  },
}, { 
  timestamps: true 
});

// Index for better query performance
vaccinationSchema.index({ childId: 1, status: 1 });
vaccinationSchema.index({ dueDate: 1 });

module.exports = mongoose.model("Vaccination", vaccinationSchema);

