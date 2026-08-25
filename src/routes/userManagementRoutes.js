
const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  suspendUser,
  activateUser,
  resetUserPassword,
  assignRole,
  assignChildrenToProvider,
  getPendingProviders,
  approveProvider,
  rejectProvider,
} = require("../controllers/userManagementController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All user management routes require admin authentication
router.use(protect);
router.use(adminOnly);

/**
 * User management routes
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Ram Sharma"
 *                 email: "ram@gmail.com"
 *                 role: "parent"
 *                 isActive: true
 *               - _id: "65f1abc123abc123abc123ac"
 *                 name: "Dr. John Smith"
 *                 email: "john@vaxocare.com"
 *                 role: "provider"
 *                 isActive: true
 */
router.get("/users", getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: User data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               _id: "65f1abc123abc123abc123ab"
 *               name: "Ram Sharma"
 *               email: "ram@gmail.com"
 *               role: "parent"
 *               isActive: true
 *               createdAt: "2024-01-01T00:00:00Z"
 */
router.get("/users/:id", getUserById);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [parent, provider, admin]
 *           example:
 *             name: "Ankit Kumar"
 *             email: "ankit@gmail.com"
 *             password: "password123"
 *             role: "parent"
 *     responses:
 *       201:
 *         description: User created
 */
router.post("/users", createUser);

/**
 * @swagger
 * /api/users/{id}/suspend:
 *   put:
 *     summary: Suspend a user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *           example:
 *             reason: "Violation of terms and conditions"
 *     responses:
 *       200:
 *         description: User suspended
 */
router.put("/users/:id/suspend", suspendUser);

/**
 * @swagger
 * /api/users/{id}/activate:
 *   put:
 *     summary: Activate a user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: User activated
 */
router.put("/users/:id/activate", activateUser);

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   put:
 *     summary: Reset user password
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *           example:
 *             newPassword: "newpassword123"
 *     responses:
 *       200:
 *         description: Password reset
 */
router.put("/users/:id/reset-password", resetUserPassword);

/**
 * @swagger
 * /api/users/{id}/assign-role:
 *   put:
 *     summary: Assign role to user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [parent, provider, admin]
 *           example:
 *             role: "provider"
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.put("/users/:id/assign-role", assignRole);

/**
 * @swagger
 * /api/users/{id}/assign-children:
 *   put:
 *     summary: Assign children to provider
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - childIds
 *             properties:
 *               childIds:
 *                 type: array
 *                 items:
 *                   type: string
 *           example:
 *             childIds: ["65f1abc123abc123abc123ab", "65f1abc123abc123abc123ac"]
 *     responses:
 *       200:
 *         description: Children assigned
 */
router.put("/users/:id/assign-children", assignChildrenToProvider);

/**
 * Provider approval routes
 */

/**
 * @swagger
 * /api/providers/pending:
 *   get:
 *     summary: Get pending provider approvals
 *     tags: [User Management - Providers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending providers list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *             example:
 *               - _id: "65f1abc123abc123abc123ab"
 *                 name: "Dr. Jane Doe"
 *                 email: "jane@clinic.com"
 *                 clinicName: "Jane's Clinic"
 *                 status: "pending"
 *                 appliedAt: "2024-01-10T00:00:00Z"
 */
router.get("/providers/pending", getPendingProviders);

/**
 * @swagger
 * /api/providers/{id}/approve:
 *   put:
 *     summary: Approve a provider
 *     tags: [User Management - Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     responses:
 *       200:
 *         description: Provider approved
 */
router.put("/providers/:id/approve", approveProvider);

/**
 * @swagger
 * /api/providers/{id}/reject:
 *   put:
 *     summary: Reject a provider
 *     tags: [User Management - Providers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "65f1abc123abc123abc123ab"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *           example:
 *             reason: "Incomplete documentation submitted"
 *     responses:
 *       200:
 *         description: Provider rejected
 */
router.put("/providers/:id/reject", rejectProvider);

module.exports = router;

