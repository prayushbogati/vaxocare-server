const mongoose = require("mongoose");

const vaccineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide vaccine name"],
    trim: true,
    unique: true,
  },
  code: {
    type: String,
    required: [true, "Please provide vaccine code"],
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    default: "",
  },
  weeksAfterBirth: {
    type: Number,
    required: [true, "Please provide weeks after birth when vaccine is due"],
    min: 0,
  },
  dosesRequired: {
    type: Number,
    default: 1,
    min: 1,
  },
  doseIntervalWeeks: {
    type: Number,
    default: 0,
    min: 0,
  },
  isCritical: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  applicableGenders: {
    type: String,
    enum: ["male", "female", "both"],
    default: "both",
  },
  minimumAgeWeeks: {
    type: Number,
    default: 0,
    min: 0,
  },
  maximumAgeWeeks: {
    type: Number,
    default: null,
    min: 0,
  },
  sideEffects: {
    type: String,
    default: "",
  },
  precautions: {
    type: String,
    default: "",
  },
}, { 
  timestamps: true 
});

// Index for querying active vaccines
vaccineSchema.index({ isActive: 1 });

module.exports = mongoose.model("Vaccine", vaccineSchema);
