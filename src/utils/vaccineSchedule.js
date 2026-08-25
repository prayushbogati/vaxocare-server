/**
 * Core vaccinations only (fixed set) up to age cut-off = 5 years (260 weeks).
 * Vaccine names should match what frontend/backend expect in UI (vaccineName).
 */
const vaccineSchedule = [
  // Birth
  { name: "BCG", weeks: 0, description: "Birth" },
  { name: "OPV 0", weeks: 0, description: "Birth" },
  { name: "Hepatitis B", weeks: 0, description: "Birth" },

  // 6/10/14 weeks (core series)
  { name: "DPT 1", weeks: 6, description: "6 weeks" },
  { name: "OPV 1", weeks: 6, description: "6 weeks" },

  { name: "DPT 2", weeks: 10, description: "10 weeks" },
  { name: "OPV 2", weeks: 10, description: "10 weeks" },

  { name: "DPT 3", weeks: 14, description: "14 weeks" },
  { name: "OPV 3", weeks: 14, description: "14 weeks" },

  // 14 weeks IPV (core catch-up in this project)
  { name: "IPV", weeks: 14, description: "14 weeks" },

  // 9 months
  { name: "Measles/Rubella", weeks: 36, description: "9 months" },

  // 1 year
  { name: "DPT Booster 1", weeks: 52, description: "1 year" },
  { name: "OPV Booster", weeks: 52, description: "1 year" },

  // 5 years
  { name: "DPT Booster 2", weeks: 260, description: "5 years" },
];

module.exports = vaccineSchedule;

