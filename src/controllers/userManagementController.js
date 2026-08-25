const User = require("../models/User");
const Child = require("../models/Child");
const Vaccination = require("../models/Vaccination");

/**
 * User Management Controller
 * Extended admin features for user management
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Admin]
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
 *         description: User details
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get additional stats based on role
    let stats = {};
    if (user.role === "parent") {
      const childrenCount = await Child.countDocuments({ parentId: user._id, isActive: true });
      stats = { childrenCount };
    } else if (user.role === "provider") {
      const childrenCount = await Child.countDocuments({ assignedProviderId: user._id, isActive: true });
      const vaccinationsCount = await Vaccination.countDocuments({ administeredBy: user._id });
      stats = { assignedChildren: childrenCount, vaccinationsAdministered: vaccinationsCount };
    }

    res.json({ ...user.toObject(), stats });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({ message: "Error fetching user" });
  }
};

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user (admin only)
 *     tags: [Admin]
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
 *     responses:
 *       201:
 *         description: User created
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Validate role
    const validRoles = ["parent", "provider", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      address,
    });

    res.status(201).json({
      message: "User created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/suspend:
 *   put:
 *     summary: Suspend/deactivate user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User suspended
 */
exports.suspendUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cannot suspend yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot suspend your own account" });
    }

    // Cannot suspend admin
    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot suspend admin users" });
    }

    user.isActive = false;
    user.suspensionReason = reason || "Suspended by admin";
    user.suspendedAt = new Date();
    user.suspendedBy = req.user._id;
    await user.save();

    res.json({ message: "User suspended successfully", data: user });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({ message: "Error suspending user" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/activate:
 *   put:
 *     summary: Activate/reactivate user
 *     tags: [Admin]
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
 *         description: User activated
 */
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = true;
    user.suspensionReason = null;
    user.suspendedAt = null;
    user.suspendedBy = null;
    user.activatedAt = new Date();
    user.activatedBy = req.user._id;
    await user.save();

    res.json({ message: "User activated successfully", data: user });
  } catch (error) {
    console.error("Activate user error:", error);
    res.status(500).json({ message: "Error activating user" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   put:
 *     summary: Reset user password (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.passwordChangedBy = req.user._id;
    user.isTemporaryPassword = true;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Error resetting password" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/assign-role:
 *   put:
 *     summary: Assign/change user role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               role:
 *                 type: string
 *                 enum: [parent, provider, admin]
 *     responses:
 *       200:
 *         description: Role updated
 */
exports.assignRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role
    const validRoles = ["parent", "provider", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Cannot change own role
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot change your own role" });
    }

    user.role = role;
    user.roleChangedAt = new Date();
    user.roleChangedBy = req.user._id;
    await user.save();

    res.json({ message: "Role updated successfully", data: user });
  } catch (error) {
    console.error("Assign role error:", error);
    res.status(500).json({ message: "Error assigning role" });
  }
};

/**
 * @swagger
 * /api/admin/users/{id}/providers:
 *   put:
 *     summary: Assign children to provider
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               childIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Children assigned
 */
exports.assignChildrenToProvider = async (req, res) => {
  try {
    const { childIds } = req.body;
    const providerId = req.params.id;

    // Verify provider exists
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Update children
    await Child.updateMany(
      { _id: { $in: childIds } },
      { assignedProviderId: providerId }
    );

    const assignedCount = await Child.countDocuments({ assignedProviderId: providerId });

    res.json({ 
      message: `Successfully assigned ${childIds.length} children to provider`,
      assignedCount 
    });
  } catch (error) {
    console.error("Assign children error:", error);
    res.status(500).json({ message: "Error assigning children" });
  }
};

/**
 * @swagger
 * /api/admin/providers/pending:
 *   get:
 *     summary: Get pending provider registrations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending providers
 */
exports.getPendingProviders = async (req, res) => {
  try {
    const pendingProviders = await User.find({
      role: "provider",
      isActive: false,
      approvalStatus: "pending",
    }).select("-password");

    res.json(pendingProviders);
  } catch (error) {
    console.error("Get pending providers error:", error);
    res.status(500).json({ message: "Error fetching pending providers" });
  }
};

/**
 * @swagger
 * /api/admin/providers/{id}/approve:
 *   put:
 *     summary: Approve provider registration
 *     tags: [Admin]
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
 *         description: Provider approved
 */
exports.approveProvider = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    user.isActive = true;
    user.approvalStatus = "approved";
    user.approvedAt = new Date();
    user.approvedBy = req.user._id;
    await user.save();

    res.json({ message: "Provider approved successfully", data: user });
  } catch (error) {
    console.error("Approve provider error:", error);
    res.status(500).json({ message: "Error approving provider" });
  }
};

/**
 * @swagger
 * /api/admin/providers/{id}/reject:
 *   put:
 *     summary: Reject provider registration
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Provider rejected
 */
exports.rejectProvider = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    user.approvalStatus = "rejected";
    user.rejectedAt = new Date();
    user.rejectedBy = req.user._id;
    user.rejectionReason = reason || "Registration rejected";
    await user.save();

    res.json({ message: "Provider rejected", data: user });
  } catch (error) {
    console.error("Reject provider error:", error);
    res.status(500).json({ message: "Error rejecting provider" });
  }
};

module.exports = exports;
