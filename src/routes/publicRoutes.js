const express = require("express");
const router = express.Router();
const SystemConfig = require("../models/SystemConfig");

/**
 * @swagger
 * /api/public/config:
 *   get:
 *     summary: Get public system configurations
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public configurations
 */
router.get("/config", async (req, res) => {
  try {
    const configs = await SystemConfig.find({ isPublic: true }).select("key value category description");
    res.json(configs);
  } catch (error) {
    console.error("Get public config error:", error);
    res.status(500).json({ message: "Error fetching configurations" });
  }
});

/**
 * @swagger
 * /api/public/config/{key}:
 *   get:
 *     summary: Get specific public configuration
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Config value
 */
router.get("/config/:key", async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ key: req.params.key, isPublic: true });
    if (!config) {
      return res.status(404).json({ message: "Configuration not found or not public" });
    }
    res.json(config);
  } catch (error) {
    console.error("Get public config error:", error);
    res.status(500).json({ message: "Error fetching configuration" });
  }
});

module.exports = router;
