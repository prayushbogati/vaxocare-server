/**
 * AI Model Management Controller
 * 
 * Handles API endpoints for managing AI model weights and versions
 */

const aiModelService = require('../services/aiModelService');
const riskModel = require('../ai/riskModel');
const trainingData = require('../ai/trainingData');
const { train } = require('../ai/weightTuner');

/**
 * Get current model configuration
 */
exports.getModelConfig = async (req, res) => {
  try {
    const config = riskModel.getModelConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get model history/versions
 */
exports.getModelHistory = async (req, res) => {
  try {
    const history = await aiModelService.getModelHistory(10);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Train model and save to database
 */
exports.trainModel = async (req, res) => {
  try {
    const { iterations = 1000, learningRate = 0.01 } = req.body;
    
    // Input validation
    const MAX_ITERATIONS = 5000;
    if (!Number.isFinite(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
      return res.status(400).json({
        success: false,
        message: `Invalid iterations: 1-${MAX_ITERATIONS}`
      });
    }
    if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid learningRate: must be (0,1]'
      });
    }
    
    // Async training job (worker stub - expand with worker_threads later)
    const jobId = `train-${Date.now()}`;
    console.log(`Training job queued: ${jobId} (iterations: ${iterations}, lr: ${learningRate})`);
    
    // Simulate async (in prod use worker/queue)
    setTimeout(async () => {
      try {
        const trainedWeights = train(iterations, learningRate);
        await aiModelService.saveModel(
          { weights: trainedWeights },
          {
            trainingIterations: iterations,
            learningRate: learningRate,
            trainingDataCount: trainingData.length
          },
          req.user?.id
        );
        await riskModel.updateModelWeights(trainedWeights);
        console.log(`Training job complete: ${jobId}`);
      } catch (e) {
        console.error(`Training job failed ${jobId}:`, e);
      }
    }, 100); // Immediate for demo
    
    res.status(202).json({
      success: true,
      message: 'Training job accepted',
      data: {
        jobId,
        iterations,
        learningRate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update model weights manually
 */
exports.updateWeights = async (req, res) => {
  try {
    const { weights, thresholds } = req.body;
    
    // Validate weights (numeric finite)
    if (!weights || 
        typeof weights.w1 !== 'number' || !Number.isFinite(weights.w1) ||
        typeof weights.w2 !== 'number' || !Number.isFinite(weights.w2) ||
        typeof weights.w3 !== 'number' || !Number.isFinite(weights.w3) ||
        typeof weights.w4 !== 'number' || !Number.isFinite(weights.w4) ||
        typeof weights.bias !== 'number' || !Number.isFinite(weights.bias)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid weights. w1,w2,w3,w4,bias must be finite numbers'
      });
    }
    
    // Save to database
    const savedModel = await aiModelService.updateModelWeights(
      { weights, thresholds },
      req.user?.id
    );
    
    // Update in-memory cache
    await riskModel.updateModelWeights(weights, { thresholds });
    
    res.json({
      success: true,
      message: 'Model weights updated successfully',
      data: {
        version: savedModel.version,
        weights
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Rollback to a specific version
 */
exports.rollbackModel = async (req, res) => {
  try {
    const { version } = req.params;
    
    // Validate version
    if (!version || !/^v\\d+$/.test(version)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing version format (expected v#)'
      });
    }
    
    const rolledBackModel = await aiModelService.rollbackToVersion(version, req.user?.id);
    
    if (!rolledBackModel) {
      return res.status(404).json({
        success: false,
        message: 'Model version not found'
      });
    }
    
    // Update in-memory cache
    await riskModel.updateModelWeights(rolledBackModel.weights);
    
    res.json({
      success: true,
      message: `Model rolled back to version ${version}`,
      data: {
        version: rolledBackModel.version,
        weights: rolledBackModel.weights
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Test prediction with current model
 */
exports.testPrediction = async (req, res) => {
  try {
    const { overdueCount = 0, missedAppointments = 0, daysSinceLast = 0, completionRate = 0 } = req.body;
    
    const prediction = await riskModel.predictRisk({
      overdueCount,
      missedAppointments,
      daysSinceLast,
      completionRate
    });
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

