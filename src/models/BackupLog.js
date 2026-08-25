const mongoose = require("mongoose");

const backupLogSchema = new mongoose.Schema({
  backupDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    required: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
  initiatedBy: {
    type: String,
    enum: ["scheduled", "admin", "manual"],
    default: "scheduled",
  },
  errorMessage: {
    type: String,
    default: "",
  },
  filesBackedUp: {
    type: Number,
    default: 0,
  },
}, { 
  timestamps: true 
});

// Index for queries
backupLogSchema.index({ backupDate: -1 });
backupLogSchema.index({ status: 1 });

module.exports = mongoose.model("BackupLog", backupLogSchema);
