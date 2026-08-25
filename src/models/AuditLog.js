const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  action: {
    type: String,
    required: true,
    enum: [
      "USER_CREATED",
      "USER_UPDATED",
      "USER_DELETED",
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGOUT",
      "PASSWORD_CHANGED",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_RESET_COMPLETED",
      "ACCOUNT_LOCKED",
      "ACCOUNT_SUSPENDED",
      "ACCOUNT_ACTIVATED",
      "ROLE_CHANGED",
      "PROVIDER_APPROVED",
      "PROVIDER_REJECTED",
      "VACCINATION_CREATED",
      "VACCINATION_UPDATED",
      "VACCINATION_DELETED",
      "VACCINATION_OVERRIDE",
      "CHILD_CREATED",
      "CHILD_UPDATED",
      "CHILD_DELETED",
      "APPOINTMENT_BOOKED",
      "APPOINTMENT_CANCELLED",
      "APPOINTMENT_RESCHEDULED",
      "CONFIG_UPDATED",
      "EXPORT_REQUESTED",
    ],
  },
  targetType: {
    type: String,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
  },
  errorMessage: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { 
  timestamps: true 
});

// Index for efficient queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

// Static method for logging
auditLogSchema.statics.log = async function(logData) {
  try {
    return await this.create(logData);
  } catch (error) {
    console.error("Audit log error:", error);
  }
};

module.exports = mongoose.model("AuditLog", auditLogSchema);
