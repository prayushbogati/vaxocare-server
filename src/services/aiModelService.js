/**
 * AI Model Service
 * 
 * Handles database operations for AI model configuration
 * This is the recommended approach for production ML systems
 */

const mongoose = require('mongoose');
const AIModelConfig = require('../models/AIModelConfig');

/**
 * Get the current active model configuration
 */
const getActiveModel = async () => {
  return await AIModelConfig.findOne({
    modelName: 'vaccinationRiskModel',
    isActive: true
  }).sort({ createdAt: -1 });
};

/**
 * Get all model versions
 */
const getAllModels = async () => {
  return await AIModelConfig.find({
    modelName: 'vaccinationRiskModel'
  }).sort({ createdAt: -1 });
};

/**
 * Save new model version to database
 */
const saveModel = async (weights, metadata = {}, userId = null) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Get latest version number (in tx for atomicity)
      const latestModel = await AIModelConfig.findOne({
        modelName: 'vaccinationRiskModel'
      }).sort({ versionNumber: -1, createdAt: -1 }).session(session);
      
      const versionNumber = (latestModel?.versionNumber || 0) + 1;
      
      // Deactivate previous models
      await AIModelConfig.updateMany(
        { modelName: 'vaccinationRiskModel', isActive: true },
        { isActive: false },
        { session }
      );
      
      // Create new model
      const newModel = new AIModelConfig({
        modelName: 'vaccinationRiskModel',
        version: `v${versionNumber}`,
        versionNumber,
        weights: weights.weights || weights,
        thresholds: weights.thresholds || { highRisk: 0.7, mediumRisk: 0.4 },
        metadata: {
          ...metadata,
          trainingIterations: metadata.trainingIterations || 1000,
          learningRate: metadata.learningRate || 0.01,
          trainingDataCount: metadata.trainingDataCount || 0,
          finalCost: metadata.finalCost
        },
        isActive: true,
        trainedBy: userId,
        trainedAt: new Date()
      });
      
      await newModel.save({ session });
      
      return newModel;
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Update model weights manually
 */
const updateModelWeights = async (weights, userId = null) => {
  const latestModel = await getActiveModel();
  
  if (!latestModel) {
    // Create first model if none exists
    return await saveModel(weights, { trainingDataCount: 0 }, userId);
  }
  
  // Create new version
  return await saveModel(weights, {
    trainingDataCount: latestModel.metadata?.trainingDataCount || 0,
    manual: true
  }, userId);
};

/**
 * Get model history/versions
 */
const getModelHistory = async (limit = 10) => {
  return await AIModelConfig.find({
    modelName: 'vaccinationRiskModel'
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('version weights isActive createdAt trainedAt trainedBy metadata');
};

/**
 * Rollback to a specific version
 */
const rollbackToVersion = async (version, userId = null) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const targetModel = await AIModelConfig.findOne({
        modelName: 'vaccinationRiskModel',
        version: version
      }).session(session);
      
      if (!targetModel) {
        throw new Error(`Model version ${version} not found`);
      }
      
      // Deactivate all versions
      await AIModelConfig.updateMany(
        { modelName: 'vaccinationRiskModel', isActive: true },
        { isActive: false },
        { session }
      );
      
      // Activate target version
      targetModel.isActive = true;
      targetModel.reactivatedAt = new Date();
      targetModel.reactivatedBy = userId;
      await targetModel.save({ session });
      
      return targetModel;
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getActiveModel,
  getAllModels,
  saveModel,
  updateModelWeights,
  getModelHistory,
  rollbackToVersion
};

