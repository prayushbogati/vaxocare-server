/**
 * AI-Based Risk Prediction Model
 * 
 * Logistic Regression Implementation for Vaccination Risk Prediction
 * 
 * Features used:
 * - overdueCount: Number of overdue vaccinations
 * - missedAppointments: Count of missed appointments
 * - daysSinceLast: Days since last vaccination
 * - completionRate: Percentage of vaccines completed
 * 
 * Formula: P = 1 / (1 + e^-(w1*x1 + w2*x2 + w3*x3 + w4*x4 + b))
 * 
 * DATABASE APPROACH: Weights are loaded from:
 * 1. Database (AIModelConfig collection) - PRODUCTION
 * 2. JSON config file - FALLBACK
 * 3. Default weights - LAST RESORT
 */

const fs = require('fs');
const path = require('path');

// Default weights (fallback)
const defaultWeights = {
  w1: 0.9,
  w2: 0.7,
  w3: 0.02,
  w4: -0.03,
  bias: -1.2
};

// Thresholds
const defaultThresholds = {
  highRisk: 0.7,
  mediumRisk: 0.4
};

// In-memory cache for model config
let modelCache = {
  weights: { ...defaultWeights },
  thresholds: { ...defaultThresholds },
  version: null,
  loaded: false,
  loadedFrom: 'default' // 'database', 'config', 'default'
};

/**
 * Load model weights from database
 * This should be called at startup and can be refreshed
 */
const loadWeightsFromDatabase = async () => {
  try {
    // Try to load from database
    const AIModelConfig = require('../models/AIModelConfig');
    
    const activeModel = await AIModelConfig.findOne({ 
      modelName: 'vaccinationRiskModel', 
      isActive: true 
    }).sort({ createdAt: -1 });
    
    if (activeModel) {
      const { weights, thresholds } = activeModel;
      if (weights && 
          Number.isFinite(weights.w1) && 
          Number.isFinite(weights.w2) && 
          Number.isFinite(weights.w3) && 
          Number.isFinite(weights.w4) && 
          Number.isFinite(weights.bias) &&
          thresholds && 
          Number.isFinite(thresholds.highRisk) && 
          Number.isFinite(thresholds.mediumRisk)) {
        modelCache.weights = weights;
        modelCache.thresholds = thresholds;
        modelCache.version = activeModel.version;
        modelCache.loaded = true;
        modelCache.loadedFrom = 'database';
        
        console.log('[AI Model] Loaded weights from database, version:', activeModel.version);
        return true;
      } else {
        console.error('[AI Model] Invalid active model weights/thresholds, skipping DB load');
      }
    }
    return false;
  } catch (error) {
    console.log('[AI Model] Database not available, trying config file...');
  }
  return false;
};

/**
 * Load model weights from JSON config file
 */
const loadWeightsFromConfig = () => {
  try {
    const configPath = path.join(__dirname, 'modelConfig.json');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (configData.weights) {
        modelCache.weights = configData.weights;
        if (configData.thresholds) {
          modelCache.thresholds = configData.thresholds;
        }
        modelCache.version = configData.lastTrained;
        modelCache.loaded = true;
        modelCache.loadedFrom = 'config';
        console.log('[AI Model] Loaded weights from modelConfig.json');
        return true;
      }
    }
  } catch (error) {
    console.warn('[AI Model] Error loading config:', error.message);
  }
  return false;
};

/**
 * Initialize model - try database first, then config, then defaults
 */
const initializeModel = async () => {
  // Try database first
  const loadedFromDB = await loadWeightsFromDatabase();
  
  if (!loadedFromDB) {
    // Try config file
    loadWeightsFromConfig();
  }
  
  return modelCache;
};

/**
 * Get current model configuration
 */
const getModelConfig = () => {
  return {
    weights: modelCache.weights,
    thresholds: modelCache.thresholds,
    version: modelCache.version,
    loadedFrom: modelCache.loadedFrom
  };
};

/**
 * Update model weights (from training or manual)
 */
const updateModelWeights = async (newWeights, options = {}) => {
  // Validate newWeights
  const requiredKeys = ['w1', 'w2', 'w3', 'w4', 'bias'];
  for (const key of requiredKeys) {
    if (!Number.isFinite(newWeights[key])) {
      throw new Error(`Invalid weight ${key}: must be finite number`);
    }
  }
  
  // Validate thresholds if provided
  if (options.thresholds) {
    if (!Number.isFinite(options.thresholds.highRisk) || !Number.isFinite(options.thresholds.mediumRisk)) {
      throw new Error('Invalid thresholds: highRisk and mediumRisk must be finite numbers');
    }
  }
  
  modelCache.weights = { ...modelCache.weights, ...newWeights };
  
  if (options.thresholds) {
    modelCache.thresholds = { ...modelCache.thresholds, ...options.thresholds };
  }
  
  modelCache.loadedFrom = 'manual';
  
  return modelCache.weights;
};

/**
 * Calculate risk probability using logistic regression
 * @param {Object} features - Input features
 * @returns {number} Probability between 0 and 1
 */
const calculateRiskProbability = (features) => {
  const {
    overdueCount = 0,
    missedAppointments = 0,
    daysSinceLast = 0,
    completionRate = 0
  } = features;

  const { w1, w2, w3, w4, bias } = modelCache.weights;

  // Calculate weighted sum
  const z = 
    w1 * overdueCount +
    w2 * missedAppointments +
    w3 * daysSinceLast +
    w4 * completionRate +
    bias;

  // Logistic function: P = 1 / (1 + e^-z)
  const probability = 1 / (1 + Math.exp(-z));

  // Clamp probability between 0 and 1
  return Math.min(Math.max(probability, 0), 1);
};

/**
 * Get risk level based on probability threshold
 * @param {number} probability - Risk probability (0-1)
 * @returns {string} Risk level: "High", "Medium", or "Low"
 */
const getRiskLevel = (probability) => {
  const { highRisk, mediumRisk } = modelCache.thresholds;
  
  if (probability > highRisk) return "High";
  if (probability > mediumRisk) return "Medium";
  return "Low";
};

/**
 * Calculate comprehensive risk prediction
 * @param {Object} childData - Child's vaccination data
 * @returns {Object} Risk prediction result
 */
const predictRisk = async (childData) => {
  const {
    overdueCount = 0,
    missedAppointments = 0,
    daysSinceLast = 0,
    completionRate = 0
  } = childData;

  // Calculate probability
  const probability = calculateRiskProbability({
    overdueCount,
    missedAppointments,
    daysSinceLast,
    completionRate
  });

  // Determine risk level
  const riskLevel = getRiskLevel(probability);

  // Generate recommendations based on risk level
  const recommendations = [];
  if (riskLevel === "High") {
    recommendations.push("Send priority reminder notifications");
    recommendations.push("Consider phone call follow-up");
    recommendations.push("Schedule catch-up vaccinations immediately");
  } else if (riskLevel === "Medium") {
    recommendations.push("Send additional email reminders");
    recommendations.push("Monitor closely");
  }

  return {
    probability: Number(probability.toFixed(3)),
    riskLevel,
    recommendations,
    modelInfo: {
      version: modelCache.version,
      loadedFrom: modelCache.loadedFrom
    }
  };
};

/**
 * Detect anomalies in vaccination records
 * @param {Object} vaccinationData - Vaccination record
 * @returns {Object} Anomaly detection result
 */
const detectAnomaly = (vaccinationData) => {
  const { scheduledDate, actualDate, dueDate, previousVaccinationDate } = vaccinationData;
  
  const anomalies = [];

  // Check: Vaccination given before due date
  if (actualDate && dueDate && new Date(actualDate) < new Date(dueDate)) {
    anomalies.push({
      type: "EARLY_VACCINATION",
      severity: "medium",
      message: "Vaccination given before the scheduled due date"
    });
  }

  // Check: Minimum interval violation
  if (previousVaccinationDate && actualDate) {
    const daysBetween = Math.floor(
      (new Date(actualDate) - new Date(previousVaccinationDate)) / (1000 * 60 * 60 * 24)
    );
    if (daysBetween < 28) {
      anomalies.push({
        type: "MINIMUM_INTERVAL_VIOLATION",
        severity: "high",
        message: `Vaccination given only ${daysBetween} days after previous dose`
      });
    }
  }

  return {
    isAnomaly: anomalies.length > 0,
    anomalies
  };
};

module.exports = {
  initializeModel,
  getModelConfig,
  updateModelWeights,
  calculateRiskProbability,
  getRiskLevel,
  predictRisk,
  detectAnomaly
};

