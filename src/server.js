const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { swaggerUi, specs } = require("./config/swagger");
const { startReminderService } = require("./utils/reminderService");

// Load environment variables
dotenv.config();

// Detect production mode - Render sets RENDER_EXTERNAL_URL or RENDER
const isProduction = !!process.env.RENDER_EXTERNAL_URL ||
  !!process.env.RENDER_SERVICE_HOSTNAME ||
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = isProduction ? 'production' : 'development';
}

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Get the proper server URL based on environment
const getServerUrl = () => {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (isProduction) {
    return `https://${process.env.RENDER_SERVICE_HOSTNAME || 'vaxocare-api.onrender.com'}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
};

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Store io instance for use in routes
app.set("io", io);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
}));
app.use(express.json());
// Needed so route controllers can read req.body for form-urlencoded requests as well
app.use(express.urlencoded({ extended: false }));

// Swagger Documentation - Serve Swagger UI static files
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Vaxocare API Docs",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  },
}));

// Routes
const authRoutes = require("./routes/authRoutes");
const childRoutes = require("./routes/childRoutes");
const vaccinationRoutes = require("./routes/vaccinationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const aiAdminRoutes = require("./routes/aiAdminRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const vaccineRoutes = require("./routes/vaccineRoutes");
const publicRoutes = require("./routes/publicRoutes");
const exportRoutes = require("./routes/exportRoutes");
const providerRoutes = require("./routes/providerRoutes");
const providerSelectionRoutes = require("./routes/providerSelectionRoutes");
const auditRoutes = require("./routes/auditRoutes");
const configRoutes = require("./routes/configRoutes");
const userManagementRoutes = require("./routes/userManagementRoutes");
const vaccinationOverrideRoutes = require("./routes/vaccinationOverrideRoutes");
const backupRoutes = require("./routes/backupRoutes");
const emailConfigRoutes = require("./routes/emailConfigRoutes");
const { initializeConfig } = require("./controllers/systemConfigController");

// Initialize system config
initializeConfig();

// Initialize AI Model (load weights from database or config) - fire-and-forget async (top-level await not in CommonJS)
const riskModel = require('./ai/riskModel');
riskModel.initializeModel().then(() => {
  console.log('[AI Model] Initialized successfully');
}).catch(err => {
  console.error('[AI Model] Init failed:', err.message);
});

app.use("/api/auth", authRoutes);
app.use("/api/children", childRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/ai", aiAdminRoutes);
app.use("/api/admin/reminders", reminderRoutes);
app.use("/api/admin/export", exportRoutes);
app.use("/api/admin/audit", auditRoutes);
app.use("/api/admin/config", configRoutes);
app.use("/api/admin/users", userManagementRoutes);
app.use("/api/admin/vaccinations", vaccinationOverrideRoutes);
app.use("/api/vaccines", vaccineRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/provider-selection", providerSelectionRoutes);
app.use("/api/admin/backup", backupRoutes);
app.use("/api/admin/email", emailConfigRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Vaxocare API Running...",
    docs: "Visit /api-docs for API documentation",
  });
});

// Start Reminder Service
startReminderService();

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  const serverUrl = getServerUrl();
  console.log(`Server running on port ${PORT}`);
  console.log(`Server mode: ${process.env.NODE_ENV}`);
  console.log(`API Documentation: ${serverUrl}/api-docs`);
});

module.exports = app;
