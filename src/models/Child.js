const mongoose = require("mongoose");

const childSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide child's name"],
    trim: true,
  },
  dateOfBirth: {
    type: Date,
    required: [true, "Please provide date of birth"],
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    default: "male",
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Region for heatmap analysis
  region: {
    type: String,
    default: "Unknown",
  },
  // Assigned healthcare provider
  assignedProviderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  bloodGroup: {
    type: String,
    enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", ""],
    default: "",
  },
  allergies: {
    type: String,
    default: "",
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Manual correction tracking
  lastCorrectionDate: {
    type: Date,
  },
  correctionApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { 
  timestamps: true 
});

// Virtual for age calculation
childSchema.virtual("age").get(function() {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for risk level
childSchema.virtual("riskLevel").get(function() {
  if (this.riskScore >= 70) return "High";
  if (this.riskScore >= 40) return "Medium";
  return "Low";
});

// Ensure virtuals are included in JSON
childSchema.set("toJSON", { virtuals: true });
childSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Child", childSchema);
