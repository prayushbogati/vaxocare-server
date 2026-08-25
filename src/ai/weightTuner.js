/**
 * Weight Tuner - Gradient Descent Simulation
 * 
 * Simple implementation of gradient descent for training the logistic regression model.
 * This demonstrates the concept of machine learning weight optimization.
 * 
 * In production, this would be run periodically with real data to update weights.
 */

const trainingData = require("./trainingData");

// Initial weights
let weights = {
  w1: 0.1,  // overdue weight
  w2: 0.1,  // missed appointments weight
  w3: 0.001, // days weight
  w4: -0.001, // completion rate weight
  bias: 0
};

// Sigmoid function with clipping to prevent overflow
const sigmoid = (z) => {
  // Clip z to prevent overflow
  const clippedZ = Math.max(-500, Math.min(500, z));
  return 1 / (1 + Math.exp(-clippedZ));
};

// Cost function (binary cross-entropy) with numerical stability
const calculateCost = (predictions, labels) => {
  const m = labels.length;
  let cost = 0;
  for (let i = 0; i < m; i++) {
    const prediction = Math.max(1e-10, Math.min(1 - 1e-10, predictions[i])); // Clip predictions
    const label = labels[i];
    cost += -label * Math.log(prediction) - (1 - label) * Math.log(1 - prediction);
  }
  return cost / m;
};

/**
 * Train the model using gradient descent
 * @param {number} iterations - Number of training iterations
 * @param {number} learningRate - Learning rate for gradient descent
 * @returns {Object} Trained weights
 */
const train = (iterations = 1000, learningRate = 0.01) => {
  console.log("Starting model training...");
  console.log("Initial weights:", weights);
  
  const m = trainingData.length;
  
  for (let iter = 0; iter < iterations; iter++) {
    const predictions = [];
    const labels = trainingData.map(d => d.label);
    
    // Forward pass
    for (let i = 0; i < m; i++) {
      const data = trainingData[i];
      const z = 
        weights.w1 * data.overdue +
        weights.w2 * data.missed +
        weights.w3 * data.days +
        weights.w4 * data.completion +
        weights.bias;
      
      predictions.push(sigmoid(z));
    }
    
    // Calculate gradients
    let dw1 = 0, dw2 = 0, dw3 = 0, dw4 = 0, dbias = 0;
    
    for (let i = 0; i < m; i++) {
      const data = trainingData[i];
      const prediction = predictions[i];
      const label = data.label;
      const error = prediction - label;
      
      dw1 += error * data.overdue;
      dw2 += error * data.missed;
      dw3 += error * data.days;
      dw4 += error * data.completion;
      dbias += error;
    }
    
    // Update weights with smaller learning rate to prevent explosion
    weights.w1 -= learningRate * dw1 / m;
    weights.w2 -= learningRate * dw2 / m;
    weights.w3 -= learningRate * dw3 / m;
    weights.w4 -= learningRate * dw4 / m;
    weights.bias -= learningRate * dbias / m;
    
    // Log progress every 100 iterations
    if (iter % 100 === 0) {
      const cost = calculateCost(predictions, labels);
      console.log(`Iteration ${iter}: Cost = ${cost.toFixed(4)}`);
    }
  }
  
  console.log("\nTraining complete!");
  console.log("Final weights:", weights);
  
  return weights;
};

/**
 * Make a prediction using trained weights
 * @param {Object} features - Input features
 * @returns {number} Prediction probability
 */
const predict = (features) => {
  const { overdue, missed, days, completion } = features;
  const z = 
    weights.w1 * overdue +
    weights.w2 * missed +
    weights.w3 * days +
    weights.w4 * completion +
    weights.bias;
  
  return sigmoid(z);
};

// Run training if executed directly
if (require.main === module) {
  train();
  
  // Test predictions
  console.log("\n--- Test Predictions ---");
  console.log("High risk case:", predict({ overdue: 3, missed: 2, days: 60, completion: 20 }).toFixed(3));
  console.log("Low risk case:", predict({ overdue: 0, missed: 0, days: 10, completion: 90 }).toFixed(3));
  
  console.log("\n--- Copy these weights to riskModel.js ---");
  console.log(`w1 = ${weights.w1.toFixed(4)}`);
  console.log(`w2 = ${weights.w2.toFixed(4)}`);
  console.log(`w3 = ${weights.w3.toFixed(4)}`);
  console.log(`w4 = ${weights.w4.toFixed(4)}`);
  console.log(`bias = ${weights.bias.toFixed(4)}`);
}

module.exports = {
  train,
  predict,
  weights
};

