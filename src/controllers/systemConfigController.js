const SystemConfig = require("../models/SystemConfig");

// Default configuration values
const DEFAULT_CONFIG = {
  DAILY_CAPACITY: 10,
  REMINDER_DAYS_BEFORE: 2,
  AI_RISK_ENABLED: true,
  EMAIL_NOTIFICATIONS_ENABLED: true,
  AUTO_OVERDUE_CHECK: true,
  MIN_VACCINATION_INTERVAL_DAYS: 28,
  SLOT_START_TIME: "09:00",
  SLOT_END_TIME: "17:00",
  SLOT_DURATION_MINUTES: 60,
};

/**
 * Initialize default config if not exists
 */
exports.initializeConfig = async () => {
  try {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      await SystemConfig.findOneAndUpdate(
        { key },
        { 
          key,
          value,
          description: getConfigDescription(key),
        },
        { upsert: true, new: true }
      );
    }
    console.log("System configuration initialized");
  } catch (error) {
    console.error("Error initializing config:", error);
  }
};

/**
 * Get configuration description
 */
const getConfigDescription = (key) => {
  const descriptions = {
    DAILY_CAPACITY: "Maximum number of appointments per time slot per day",
    REMINDER_DAYS_BEFORE: "Number of days before due date to send reminder",
    AI_RISK_ENABLED: "Enable AI-powered risk prediction system",
    EMAIL_NOTIFICATIONS_ENABLED: "Enable email notifications to parents",
    AUTO_OVERDUE_CHECK: "Automatically mark vaccinations as overdue",
    MIN_VACCINATION_INTERVAL_DAYS: "Minimum days between vaccinations",
    SLOT_START_TIME: "Daily appointment slot start time (HH:mm)",
    SLOT_END_TIME: "Daily appointment slot end time (HH:mm)",
    SLOT_DURATION_MINUTES: "Duration of each appointment slot in minutes",
  };
  return descriptions[key] || "";
};

/**
 * @swagger
 * /api/admin/config:
 *   get:
 *     summary: Get all system configurations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of configurations
 */
exports.getAllConfig = async (req, res) => {
  try {
    const configs = await SystemConfig.find({ isActive: true }).sort({ key: 1 });
    
    // Convert to key-value object
    const configObj = {};
    configs.forEach(c => {
      configObj[c.key] = c.value;
    });

    res.json(configs);
  } catch (error) {
    console.error("Get all config error:", error);
    res.status(500).json({ message: "Error fetching configurations" });
  }
};

/**
 * @swagger
 * /api/admin/config/{key}:
 *   get:
 *     summary: Get specific configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration details
 */
exports.getConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const config = await SystemConfig.findOne({ key, isActive: true });

    if (!config) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    res.json(config);
  } catch (error) {
    console.error("Get config error:", error);
    res.status(500).json({ message: "Error fetching configuration" });
  }
};

/**
 * @swagger
 * /api/admin/config/{key}:
 *   put:
 *     summary: Update system configuration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: mixed
 *     responses:
 *       200:
 *         description: Configuration updated
 */
exports.updateConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Validate key
    const validKeys = Object.keys(DEFAULT_CONFIG);
    if (!validKeys.includes(key)) {
      return res.status(400).json({ 
        message: `Invalid configuration key. Valid keys: ${validKeys.join(", ")}` 
      });
    }

    // Validate value type
    const defaultValue = DEFAULT_CONFIG[key];
    if (typeof defaultValue === "number" && typeof value !== "number") {
      return res.status(400).json({ message: "Value must be a number" });
    }
    if (typeof defaultValue === "boolean" && typeof value !== "boolean") {
      return res.status(400).json({ message: "Value must be a boolean" });
    }
    if (typeof defaultValue === "string" && typeof value !== "string") {
      return res.status(400).json({ message: "Value must be a string" });
    }

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      { 
        value,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    res.json({
      message: "Configuration updated successfully",
      data: config,
    });
  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({ message: "Error updating configuration" });
  }
};

/**
 * @swagger
 * /api/admin/config/reset:
 *   post:
 *     summary: Reset all configurations to default
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations reset
 */
exports.resetConfig = async (req, res) => {
  try {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      await SystemConfig.findOneAndUpdate(
        { key },
        { 
          key,
          value,
          description: getConfigDescription(key),
          updatedBy: req.user._id,
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: "All configurations reset to default" });
  } catch (error) {
    console.error("Reset config error:", error);
    res.status(500).json({ message: "Error resetting configurations" });
  }
};

/**
 * Helper function to get config value
 */
exports.getConfigValue = async (key) => {
  try {
    const config = await SystemConfig.findOne({ key, isActive: true });
    return config ? config.value : DEFAULT_CONFIG[key];
  } catch (error) {
    console.error("Error getting config value:", error);
    return DEFAULT_CONFIG[key];
  }
};

module.exports = exports;
