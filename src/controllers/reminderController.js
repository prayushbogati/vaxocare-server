/**
 * AI Reminder Queue Controller
 *
 * Provides API endpoints for managing AI-driven reminder priority queue
 * Allows admins to view queue status, process reminders, and get insights
 */

const Vaccination = require("../models/Vaccination");
const Child = require("../models/Child");
const { reminderService } = require("../utils/reminderService");
const {
  buildPriorityQueue,
  getQueueStats,
  processPriorityQueue,
  getNextPriorityReminders,
  getCriticalChildren,
  calculatePriorityScore,
} = require("../utils/reminderPriorityQueue");

/**
 * @swagger
 * /api/admin/reminders/queue:
 *   get:
 *     summary: Get AI-driven reminder queue status
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue status with statistics
 */
exports.getQueueStatus = async (req, res) => {
  try {
    const stats = await getQueueStats(7);

    res.json({
      message: "AI Reminder Queue Status",
      data: stats,
    });
  } catch (error) {
    console.error("Get queue status error:", error);
    res.status(500).json({ message: "Error fetching queue status" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/priority-list:
 *   get:
 *     summary: Get prioritized reminder list
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Prioritized list of reminders
 */
exports.getPriorityList = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const queue = await buildPriorityQueue(7);

    res.json({
      message: "Priority Reminder List",
      total: queue.length,
      data: queue.slice(0, limit),
    });
  } catch (error) {
    console.error("Get priority list error:", error);
    res.status(500).json({ message: "Error fetching priority list" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/critical:
 *   get:
 *     summary: Get critical cases requiring immediate attention
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of critical cases
 */
exports.getCriticalCases = async (req, res) => {
  try {
    const critical = await getCriticalChildren();

    res.json({
      message: "Critical Cases Requiring Immediate Attention",
      total: critical.length,
      data: critical,
    });
  } catch (error) {
    console.error("Get critical cases error:", error);
    res.status(500).json({ message: "Error fetching critical cases" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/process:
 *   post:
 *     summary: Process and send priority reminders
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxReminders:
 *                 type: integer
 *                 default: 50
 *     responses:
 *       200:
 *         description: Processing results
 */
// persistent job tracker using Redis (survives restarts / multi-instance deployments)
// Falls back to in-memory storage if Redis is unavailable
const { v4: uuidv4 } = require("uuid");

let redisClient = null;
let useRedis = false;
let redisInitPromise = null;

// In-memory fallback storage
const memoryJobStore = new Map();

let reconnectScheduled = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 5000;

function handleRedisFailure(err, jobId) {
  console.error("Redis failure", jobId ? `for job ${jobId}` : "", err);
  // gracefully shut down client before marking Redis as unusable
  if (redisClient) {
    // attempt to quit but don't block callers
    redisClient
      .quit()
      .catch(() => {})
      .finally(() => {
        useRedis = false;
        redisClient = null;
      });
  } else {
    // if there's no client, just make sure the flag is off
    useRedis = false;
  }

  if (!reconnectScheduled) {
    reconnectScheduled = true;
    scheduleRedisReconnect();
  }
}

function scheduleRedisReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn("Max Redis reconnect attempts reached");
    reconnectScheduled = false;
    return;
  }
  const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;
  setTimeout(() => {
    redisInitPromise = initRedis();
    redisInitPromise
      .then(() => {
        reconnectAttempts = 0;
        reconnectScheduled = false;
      })
      .catch(() => {
        reconnectScheduled = false;
        scheduleRedisReconnect();
      });
  }, delay);
}

async function initRedis() {
  try {
    const redis = require("redis");
    const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = redis.createClient({ url: REDIS_URL });

    redisClient.on("error", (err) => {
      console.error("Redis error event:", err);
      handleRedisFailure(err);
    });
    redisClient.on("end", () => {
      console.warn("Redis connection closed");
      handleRedisFailure(new Error("connection ended"));
    });

    await redisClient.connect();
    useRedis = true;
    console.log("Redis connected successfully");
  } catch (error) {
    console.warn(
      "Redis initialization failed, using in-memory storage:",
      error.message,
    );
    handleRedisFailure(error);
  }
}

// Initialize Redis connection and keep promise
redisInitPromise = initRedis();

const JOB_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// periodically purge old in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of memoryJobStore.entries()) {
    const age = now - (job.updatedAt || job.createdAt || 0);
    if (age > JOB_TTL_SECONDS * 1000) {
      memoryJobStore.delete(id);
    }
  }
}, JOB_TTL_SECONDS * 1000);

async function createJob(jobId) {
  // ensure redis initialized
  if (redisInitPromise) await redisInitPromise;
  if (useRedis && redisClient && redisClient.isOpen) {
    try {
      const key = `reminderJob:${jobId}`;
      await redisClient.hSet(key, { status: "queued" });
      await redisClient.expire(key, JOB_TTL_SECONDS);
    } catch (err) {
      handleRedisFailure(err, jobId);
      memoryJobStore.set(jobId, { status: "queued", createdAt: Date.now() });
    }
  } else {
    memoryJobStore.set(jobId, { status: "queued", createdAt: Date.now() });
  }
}

async function updateJob(jobId, fields) {
  if (redisInitPromise) await redisInitPromise;
  if (useRedis && redisClient && redisClient.isOpen) {
    try {
      const key = `reminderJob:${jobId}`;
      if (fields.status) await redisClient.hSet(key, "status", fields.status);
      if (fields.result !== undefined)
        await redisClient.hSet(key, "result", JSON.stringify(fields.result));
      if (fields.error !== undefined)
        await redisClient.hSet(key, "error", fields.error);
      // refresh TTL on each update
      await redisClient.expire(key, JOB_TTL_SECONDS);
    } catch (err) {
      handleRedisFailure(err, jobId);
      const job = memoryJobStore.get(jobId) || {};
      memoryJobStore.set(jobId, { ...job, ...fields, updatedAt: Date.now() });
    }
  } else {
    const job = memoryJobStore.get(jobId) || {};
    memoryJobStore.set(jobId, { ...job, ...fields, updatedAt: Date.now() });
  }
}

async function getJob(jobId) {
  if (redisInitPromise) await redisInitPromise;
  if (useRedis && redisClient && redisClient.isOpen) {
    try {
      const key = `reminderJob:${jobId}`;
      const data = await redisClient.hGetAll(key);
      if (!data || Object.keys(data).length === 0) return null;
      let result;
      if (data.result) {
        try {
          result = JSON.parse(data.result);
        } catch (err) {
          console.error("Malformed JSON in job result", jobId, err);
          result = undefined;
        }
      }
      return {
        status: data.status,
        result,
        error: data.error,
      };
    } catch (err) {
      handleRedisFailure(err, jobId);
      const job = memoryJobStore.get(jobId);
      if (!job) return null;
      return { status: job.status, result: job.result, error: job.error };
    }
  } else {
    const job = memoryJobStore.get(jobId);
    if (!job) return null;
    return {
      status: job.status,
      result: job.result,
      error: job.error,
    };
  }
}

exports.processReminders = async (req, res) => {
  try {
    let {
      maxReminders = 50,
      batchSize = 10,
      delayBetweenBatches = 60000,
    } = req.body;

    // validate inputs
    maxReminders = parseInt(maxReminders, 10);
    if (isNaN(maxReminders) || maxReminders < 1) maxReminders = 1;
    if (maxReminders > 100) maxReminders = 100; // clamp sensible max

    batchSize = parseInt(batchSize, 10);
    if (isNaN(batchSize) || batchSize < 1) batchSize = 10;

    delayBetweenBatches = parseInt(delayBetweenBatches, 10);
    if (isNaN(delayBetweenBatches) || delayBetweenBatches < 0)
      delayBetweenBatches = 60000;

    const jobId = uuidv4();
    await createJob(jobId);

    // fire-and-forget background execution
    (async () => {
      try {
        await updateJob(jobId, { status: "running" });
      } catch (e) {
        console.error("updateJob running failure", jobId, e);
      }

      try {
        const result = await processPriorityQueue({
          maxReminders,
          batchSize,
          delayBetweenBatches,
        });
        try {
          await updateJob(jobId, { status: "completed", result });
        } catch (e) {
          console.error("updateJob completed failure", jobId, e);
        }
      } catch (err) {
        try {
          await updateJob(jobId, { status: "failed", error: err.message });
        } catch (e) {
          console.error("updateJob failed failure", jobId, e);
        }
      }
    })();

    res.status(202).json({
      message: "Processing started",
      jobId,
    });
  } catch (error) {
    console.error("Process reminders error:", error);
    res.status(500).json({ message: "Error processing reminders" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/refresh-scores:
 *   post:
 *     summary: Refresh all priority scores
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scores refreshed
 */

/**
 * @swagger
 * /api/admin/reminders/process/{jobId}:
 *   get:
 *     summary: Get status of a reminder processing job
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 result:
 *                   type: object
 *                 error:
 *                   type: string
 *       404:
 *         description: Job not found or expired
 */
exports.getJobStatus = async (req, res) => {
  const { jobId } = req.params;
  const job = await getJob(jobId);
  if (!job) {
    return res.status(404).json({ message: "Job not found or expired" });
  }

  const payload = { status: job.status };
  if (job.status === "completed" && job.result !== undefined)
    payload.result = job.result;
  if (job.status === "failed" && job.error !== undefined)
    payload.error = job.error;

  res.json({ jobId, ...payload });
};

exports.refreshPriorityScores = async (req, res) => {
  try {
    const count = await reminderService.updateAllPriorityScores();

    res.json({
      message: "Priority scores refreshed",
      updated: count,
    });
  } catch (error) {
    console.error("Refresh scores error:", error);
    res.status(500).json({ message: "Error refreshing priority scores" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/vaccination/{id}/priority:
 *   get:
 *     summary: Get priority score for specific vaccination
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Priority details
 */
exports.getVaccinationPriority = async (req, res) => {
  try {
    const { id } = req.params;

    const vaccination = await Vaccination.findById(id).populate(
      "childId",
      "name riskScore",
    );

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination not found" });
    }

    if (!vaccination.childId) {
      return res.status(400).json({ message: "Child data not found" });
    }

    const priority = await calculatePriorityScore({
      vaccination,
      child: vaccination.childId,
      reminderCount: vaccination.reminderCount || 0,
    });

    res.json({
      message: "Vaccination Priority Analysis",
      data: priority,
    });
  } catch (error) {
    console.error("Get vaccination priority error:", error);
    res.status(500).json({ message: "Error fetching priority" });
  }
};

/**
 * @swagger
 * /api/admin/reminders/analytics:
 *   get:
 *     summary: Get reminder analytics and insights
 *     tags: [AI Reminders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 */
exports.getReminderAnalytics = async (req, res) => {
  try {
    // Get vaccination stats
    const totalPending = await Vaccination.countDocuments({
      status: "pending",
    });
    const totalOverdue = await Vaccination.countDocuments({
      status: "overdue",
    });
    const totalCompleted = await Vaccination.countDocuments({
      status: "completed",
    });

    // Get reminder stats
    const withReminders = await Vaccination.countDocuments({
      reminderCount: { $gt: 0 },
    });
    const multipleReminders = await Vaccination.countDocuments({
      reminderCount: { $gte: 3 },
    });

    // Get children at risk
    const highRiskChildren = await Child.countDocuments({
      riskScore: { $gte: 70 },
      isActive: true,
    });

    // Get queue stats
    const queueStats = await getQueueStats(14);

    // Calculate response rate (completed after reminder)
    const respondedToReminder = await Vaccination.countDocuments({
      reminderCount: { $gt: 0 },
      status: "completed",
    });

    const responseRate =
      withReminders > 0
        ? Number(
            parseFloat(
              ((respondedToReminder / withReminders) * 100).toFixed(2),
            ),
          )
        : 0;

    res.json({
      message: "Reminder Analytics",
      data: {
        vaccinationStatus: {
          pending: totalPending,
          overdue: totalOverdue,
          completed: totalCompleted,
        },
        reminderStats: {
          totalSent: withReminders,
          multipleRemindersSent: multipleReminders,
          respondedAfterReminder: respondedToReminder,
          responseRate: responseRate,
        },
        riskAnalysis: {
          highRiskChildren,
          criticalInQueue: queueStats?.byUrgency?.CRITICAL || 0,
          highPriorityInQueue: queueStats?.byUrgency?.HIGH || 0,
        },
        queueOverview: queueStats,
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ message: "Error fetching analytics" });
  }
};

module.exports = exports;
