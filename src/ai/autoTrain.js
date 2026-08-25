/**
 * Automated Training Script with Database Support
 * 
 * Loads .env, connects to database, trains model, saves to database + config
 */

require('dotenv').config({ path: '../../.env' });

const fs = require('fs');
const path = require('path');

// Database connection
const connectDB = require('../config/db');

// AI services
const aiModelService = require('../services/aiModelService');

// Training modules
const trainingData = require('./trainingData');
const { train } = require('./weightTuner');

// Check MONGO_URI
if (!process.env.MONGO_URI) {
  console.error(' MONGO_URI not found in .env file');
  console.log('Add to Backend/.env:');
  console.log('MONGO_URI="mongodb://localhost:27017/vaxocare"');
  console.log('\nRunning without database (config file only)...');
  runTrainingOnly();
} else {
  console.log('Connecting to database...');
  connectDB().then(async () => {
    await runFullTraining();
  }).catch(error => {
    console.error(' Database connection failed:', error.message);
    console.log('Running without database...');
    runTrainingOnly();
  });
}

async function runFullTraining() {
  console.log('Database connected');
  
  console.log('==================================================');
  console.log('   AUTOMATED AI MODEL TRAINING');
  console.log('==================================================\n');
  
  console.log('Step 1: Training the model...\n');
  const trainedWeights = train(1000, 0.01);
  
  console.log('\nStep 2: Saving to DATABASE...\n');
  
  try {
    
    // Direct DB logic replaced by aiModelService.saveModel (handles tx/versionNumber)
    
    const metadata = {
      trainingIterations: 1000,
      learningRate: 0.01,
      trainingDataCount: trainingData.length
    };
    
    const savedModel = await aiModelService.saveModel(
      {
        weights: {
          w1: trainedWeights.w1,
          w2: trainedWeights.w2,
          w3: trainedWeights.w3,
          w4: trainedWeights.w4,
          bias: trainedWeights.bias
        }
      },
      metadata
    );
    
    console.log(`✓ Model saved to DATABASE (${savedModel.version})`);
    
    await saveConfigBackup(trainedWeights, savedModel.versionNumber);
    
  } catch (error) {
    console.error(' DB save failed:', error.message);
    saveConfigBackup(trainedWeights, 1);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.connection.close().catch(console.error);
  }
  
  showResults(trainedWeights);
}

function runTrainingOnly() {
  console.log('==================================================');
  console.log('   TRAINING (CONFIG FILE ONLY)');
  console.log('==================================================\n');
  
  console.log('Step 1: Training the model...\n');
  const trainedWeights = train(1000, 0.01);
  
  saveConfigBackup(trainedWeights, 1);
  showResults(trainedWeights);
}

function saveConfigBackup(trainedWeights, versionNumber, dbError = null) {
  try {
    const configPath = path.join(__dirname, 'modelConfig.json');
    const modelConfig = {
      version: `v${versionNumber}`,
      lastTrained: new Date().toISOString().split('T')[0],
      weights: {
        w1: trainedWeights.w1,
        w2: trainedWeights.w2,
        w3: trainedWeights.w3,
        w4: trainedWeights.w4,
        bias: trainedWeights.bias
      },
      metadata: {
        trainingIterations: 1000,
        learningRate: 0.01,
        trainingDataCount: trainingData.length
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(modelConfig, null, 2));
    console.log('✓ Config backup saved');
  } catch (backupErr) {
    const errMsg = dbError ? `Backup failed after DB error: ${dbError.message}. Backup err: ${backupErr.message}` : `Backup failed: ${backupErr.message}`;
    console.error( errMsg);
  }
}

function showResults(trainedWeights) {
  console.log('\n==================================================');
  console.log('   TRAINING COMPLETE!');
  console.log('==================================================');
  
  console.log('\nTrained weights:');
  console.log(`  w1: ${trainedWeights.w1.toFixed(4)}`);
  console.log(`  w2: ${trainedWeights.w2.toFixed(4)}`);
  console.log(`  w3: ${trainedWeights.w3.toFixed(4)}`);
  console.log(`  w4: ${trainedWeights.w4.toFixed(4)}`);
  console.log(`  bias: ${trainedWeights.bias.toFixed(4)}`);
  
  console.log('\nTest predictions:');
  const testHigh = 1 / (1 + Math.exp(-(trainedWeights.w1*3 + trainedWeights.w2*2 + trainedWeights.w3*60 + trainedWeights.w4*20 + trainedWeights.bias)));
  const testLow = 1 / (1 + Math.exp(-(trainedWeights.w1*0 + trainedWeights.w2*0 + trainedWeights.w3*10 + trainedWeights.w4*90 + trainedWeights.bias)));
  
  console.log(`  High risk: ${(testHigh).toFixed(3)} (${testHigh > 0.7 ? 'HIGH' : testHigh > 0.4 ? 'MEDIUM' : 'LOW'})`);
  console.log(`  Low risk: ${(testLow).toFixed(3)} (${testLow > 0.7 ? 'HIGH' : testLow > 0.4 ? 'MEDIUM' : 'LOW'})`);
}

