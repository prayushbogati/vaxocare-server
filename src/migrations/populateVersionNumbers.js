/**
 * One-time migration to populate versionNumber from version string
 * Run: node Backend/src/migrations/populateVersionNumbers.js
 */

require('dotenv').config({ path: '../../../.env' });
const mongoose = require('mongoose');
const AIModelConfig = require('../models/AIModelConfig');
const connectDB = require('../../config/db');

async function migrate() {
  await connectDB();
  
  console.log('Migrating versionNumbers...');
  
  const models = await AIModelConfig.find({ modelName: 'vaccinationRiskModel', versionNumber: { $exists: false } });
  
  for (const model of models) {
    const versionNum = parseInt(model.version.replace('v', ''));
    model.versionNumber = isNaN(versionNum) ? 0 : versionNum;
    await model.save();
    console.log(`Updated ${model.version} -> versionNumber: ${model.versionNumber}`);
  }
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

