/**
 * AI Model Configuration Schema
 * 
 * This model stores AI model weights and version history in the database.
 * This is the recommended approach for production ML systems.
 */

const mongoose = require("mongoose");

const aiModelConfigSchema = new mongoose.Schema({
  modelName: {
    type: String,
    default: "vaccinationRiskModel",
    required: true
  },
  version: {
    type: String,
    required: true
  },
  versionNumber: {
    type: Number,
    index: true
  },
  weights: {
    w1: { type: Number, default: 0.9 },    // overdue weight
    w2: { type: Number, default: 0.7 },    // missed appointments weight
    w3: { type: Number, default: 0.02 },    // days weight
    w4: { type: Number, default: -0.03 },   // completion rate weight
    bias: { type: Number, default: -1.2 }   // bias
  },
  thresholds: {
    highRisk: { type: Number, default: 0.7 },
    mediumRisk: { type: Number, default: 0.4 }
  },
  metadata: {
    trainingIterations: { type: Number, default: 1000 },
    learningRate: { type: Number, default: 0.01 },
    trainingDataCount: { type: Number, default: 0 },
    finalCost: { type: Number }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  trainedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  trainedAt: {
    type: Date,
    default: Date.now
  },
  reactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reactivatedAt: {
    type: Date
  }
}, { 
  timestamps: true 
});

// Indexes for fast lookups
aiModelConfigSchema.index({ modelName: 1, isActive: 1 });
aiModelConfigSchema.index({ modelName: 1, versionNumber: -1 });
aiModelConfigSchema.index({ modelName: 1, version: -1 });

module.exports = mongoose.model("AIModelConfig", aiModelConfigSchema);

