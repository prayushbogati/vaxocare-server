const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    enum: [
      "DAILY_CAPACITY",
      "REMINDER_DAYS_BEFORE",
      "AI_RISK_ENABLED",
      "EMAIL_NOTIFICATIONS_ENABLED",
      "AUTO_OVERDUE_CHECK",
      "MIN_VACCINATION_INTERVAL_DAYS",
      "SLOT_START_TIME",
      "SLOT_END_TIME",
      "SLOT_DURATION_MINUTES",
    ],
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
