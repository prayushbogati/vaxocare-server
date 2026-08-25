const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Dynamic server URL based on environment
// Note: This runs at module load time, before server.js sets NODE_ENV
const getServerUrl = () => {
  // Check for Render environment variables
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  if (process.env.RENDER_SERVICE_HOSTNAME) {
    return `https://${process.env.RENDER_SERVICE_HOSTNAME}`;
  }
  // Fallback - will be overridden by server.js at runtime
  return "http://localhost:5000";
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Vaxocare API",
      version: "1.0.0",
      description: `
       Vaxocare - Smart Vaccination Management System
      
      ## Features
      - User Authentication (JWT)
      - Child Profile Management
      - Automated Vaccine Schedule Generation
      - Smart Appointment Booking with Capacity Control
      - AI-Based Risk Prediction
      - Real-time Dashboard Updates
      - Email Reminders
      
      ## User Roles
      - **parent**: Parents can manage their children's vaccinations
      - **provider**: Healthcare providers can manage vaccinations
      - **admin**: Admin has full access to dashboard and analytics
      
      ## Testing Flow
      1. Register a user with role "parent"
      2. Login to get JWT token
      3. Create a child profile
      4. System automatically generates vaccination schedule
      5. Book appointments and mark vaccinations as completed
      `,
      contact: {
        name: "Vaxocare Team",
        email: "support@vaxocare.com",
      },
    },
    servers: [
      {
        url: getServerUrl(),
        description: process.env.NODE_ENV === "production" ? "Production Server" : "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token (without 'Bearer' prefix)",
        },
      },
      schemas: {
        // User Schema
        User: {
          type: "object",
          properties: {
            name: { type: "string", example: "Ram Sharma" },
            email: { type: "string", example: "ram@gmail.com" },
            password: { type: "string", example: "password123" },
            role: { 
              type: "string", 
              enum: ["parent", "provider", "admin"],
              example: "parent" 
            },
          },
        },
        // Child Schema
        Child: {
          type: "object",
          properties: {
            name: { type: "string", example: "Aarav Sharma" },
            dateOfBirth: { type: "string", example: "2024-01-01" },
            parentId: { type: "string", example: "65f1abc123abc123abc123ab" },
          },
        },
        // Vaccination Schema
        Vaccination: {
          type: "object",
          properties: {
            childId: { type: "string", example: "65f1abc123abc123abc123ab" },
            vaccineName: { type: "string", example: "DPT 1" },
            dueDate: { type: "string", example: "2024-02-12" },
            scheduledDate: { type: "string", example: "2024-02-15" },
            appointmentTime: { type: "string", example: "10:30 AM" },
            status: { 
              type: "string", 
              enum: ["pending", "completed", "overdue"],
              example: "pending" 
            },
            anomalyFlag: { type: "boolean", example: false },
          },
        },
        // Booking Schema
        Booking: {
          type: "object",
          properties: {
            selectedDate: { type: "string", example: "2024-02-15" },
            selectedTime: { type: "string", example: "10:30 AM" },
          },
        },
        // Login Request
        LoginRequest: {
          type: "object",
          properties: {
            email: { type: "string", example: "ram@gmail.com" },
            password: { type: "string", example: "password123" },
          },
        },
        // Login Response
        LoginResponse: {
          type: "object",
          properties: {
            token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            role: { type: "string", example: "parent" },
            name: { type: "string", example: "Ram Sharma" },
          },
        },
        // Dashboard Stats
        DashboardStats: {
          type: "object",
          properties: {
            totalChildren: { type: "number", example: 150 },
            totalVaccines: { type: "number", example: 750 },
            completedVaccines: { type: "number", example: 600 },
            overdueVaccines: { type: "number", example: 50 },
            completionRate: { type: "string", example: "80.00" },
          },
        },
        // Risk Prediction
        RiskPrediction: {
          type: "object",
          properties: {
            childId: { type: "string", example: "65f1abc123abc123abc123ab" },
            riskProbability: { type: "number", example: 0.75 },
            riskLevel: { 
              type: "string", 
              enum: ["High", "Medium", "Low"],
              example: "High" 
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };

