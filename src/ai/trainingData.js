/**
 * Training Data for AI Model
 * 
 * Simulated dataset for training the risk prediction model.
 * In a production system, this would be collected from real data.
 * 
 * Features:
 * - overdue: Number of overdue vaccinations
 * - missed: Number of missed appointments
 * - days: Days since last vaccination
 * - completion: Completion rate percentage
 * 
 * Label:
 * - 1 = High Risk (likely to miss next vaccination)
 * - 0 = Low Risk (likely to attend)
 */

module.exports = [
  { overdue: 3, missed: 2, days: 60, completion: 20, label: 1 },
  { overdue: 0, missed: 0, days: 10, completion: 90, label: 0 },
  { overdue: 2, missed: 1, days: 40, completion: 50, label: 1 },
  { overdue: 1, missed: 0, days: 20, completion: 70, label: 0 },
  { overdue: 4, missed: 3, days: 90, completion: 10, label: 1 },
  { overdue: 0, missed: 0, days: 5, completion: 95, label: 0 },
  { overdue: 2, missed: 2, days: 35, completion: 45, label: 1 },
  { overdue: 1, missed: 1, days: 15, completion: 75, label: 0 },
  { overdue: 3, missed: 2, days: 55, completion: 30, label: 1 },
  { overdue: 0, missed: 1, days: 8, completion: 85, label: 0 },
];

