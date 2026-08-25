const User = require("../models/User");
const Session = require("../models/Session");
const PasswordReset = require("../models/PasswordReset");
const AuditLog = require("../models/AuditLog");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../utils/emailService");

/**
 * Generate JWT Token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

/**
 * Get client IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ram Sharma"
 *               email:
 *                 type: string
 *                 example: "ram@gmail.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [parent, provider, admin]
 *                 default: parent
 *                 example: "parent"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Determine if user needs approval
    let isApproved = true;
    if (role === "provider") {
      isApproved = false; // Providers need admin approval
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "parent",
      phone: phone || "",
      address: address || "",
      isApproved,
    });

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(email, name).catch(console.error);

    // Log user creation
    await AuditLog.log({
      userId: user._id,
      action: "USER_CREATED",
      targetType: "User",
      targetId: user._id,
      description: `New user registered: ${email}`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      message: role === "provider" 
        ? "Registration successful. Please wait for admin approval to access your account."
        : "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "ram@gmail.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account locked or inactive
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      await AuditLog.log({
        action: "LOGIN_FAILED",
        targetType: "User",
        description: `Failed login attempt for email: ${email}`,
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "User not found",
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.log({
        userId: user._id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user._id,
        description: `Inactive account login attempt: ${email}`,
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "Account is inactive",
      });
      return res.status(403).json({ message: "Account is deactivated. Please contact admin." });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await AuditLog.log({
        userId: user._id,
        action: "ACCOUNT_LOCKED",
        targetType: "User",
        targetId: user._id,
        description: `Locked account login attempt: ${email}`,
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "Account is locked",
      });
      return res.status(403).json({ 
        message: "Account is temporarily locked. Please try again later.",
        lockedUntil: user.lockedUntil 
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      // Increment login attempts
      const attempts = (user.loginAttempts || 0) + 1;
      let lockedUntil = null;
      
      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
        await AuditLog.log({
          userId: user._id,
          action: "ACCOUNT_LOCKED",
          targetType: "User",
          targetId: user._id,
          description: `Account locked after ${attempts} failed login attempts`,
          ipAddress,
          userAgent,
        });
      }

      await User.findByIdAndUpdate(user._id, {
        loginAttempts: attempts,
        lockedUntil,
      });

      await AuditLog.log({
        userId: user._id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user._id,
        description: `Failed login attempt. Attempts: ${attempts}/5`,
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "Invalid password",
      });

      return res.status(401).json({ 
        message: attempts >= 5 
          ? "Account locked due to too many failed attempts. Try again in 30 minutes."
          : "Invalid credentials"
      });
    }

    // Check if provider is approved
    if (user.role === "provider" && !user.isApproved) {
      await AuditLog.log({
        userId: user._id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user._id,
        description: `Unapproved provider login attempt: ${email}`,
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "Provider not approved",
      });
      return res.status(403).json({ message: "Your account is pending approval. Please contact admin." });
    }

    // Reset login attempts on successful login
    await User.findByIdAndUpdate(user._id, {
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      $push: {
        loginHistory: {
          timestamp: new Date(),
          ipAddress,
          userAgent,
          success: true,
        }
      }
    });

    // Generate token
    const token = generateToken(user._id);

    // Calculate token expiration (7 days from now)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

    // Create session for tracking
    await Session.create({
      userId: user._id,
      token,
      deviceInfo: userAgent.substring(0, 255),
      ipAddress,
      userAgent,
      isActive: true,
      expiresAt: tokenExpiry,
      lastActivity: new Date(),
    });

    // Emit session update via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("userOnline", { 
        userId: user._id, 
        role: user.role,
        name: user.name 
      });
    }

    await AuditLog.log({
      userId: user._id,
      action: "LOGIN_SUCCESS",
      targetType: "User",
      targetId: user._id,
      description: `Successful login`,
      ipAddress,
      userAgent,
    });

    res.json({
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authorized
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ data: user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "ram@gmail.com"
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!email) {
      return res.status(400).json({ message: "Please provide email address" });
    }

    const user = await User.findOne({ email });
    
    // Even if user doesn't exist, return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ 
        message: "If an account exists with this email, you will receive a password reset link." 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(400).json({ message: "Account is deactivated" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save reset token to database
    await PasswordReset.create({
      email,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress,
      userAgent,
    });

    // Send reset email
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(email, user.name, resetUrl).catch(console.error);

    await AuditLog.log({
      userId: user._id,
      action: "PASSWORD_RESET_REQUESTED",
      targetType: "User",
      targetId: user._id,
      description: `Password reset requested`,
      ipAddress,
      userAgent,
    });

    res.status(200).json({ 
      message: "If an account exists with this email, you will receive a password reset link." 
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!password) {
      return res.status(400).json({ message: "Please provide new password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Hash the token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find valid reset token
    const resetRecord = await PasswordReset.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() },
      used: false,
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Find user
    const user = await User.findOne({ email: resetRecord.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update password
    user.password = password;
    await user.save();

    // Mark token as used
    resetRecord.used = true;
    resetRecord.usedAt = new Date();
    await resetRecord.save();

    await AuditLog.log({
      userId: user._id,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: user._id,
      description: `Password reset completed`,
      ipAddress,
      userAgent,
    });

    res.status(200).json({ message: "Password reset successful. Please login with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change password (authenticated)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide current and new password" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      await AuditLog.log({
        userId: user._id,
        action: "PASSWORD_CHANGED",
        targetType: "User",
        targetId: user._id,
        description: "Failed: Incorrect current password",
        ipAddress,
        userAgent,
        status: "failed",
        errorMessage: "Incorrect current password",
      });
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    await AuditLog.log({
      userId: user._id,
      action: "PASSWORD_CHANGED",
      targetType: "User",
      targetId: user._id,
      description: "Password changed successfully",
      ipAddress,
      userAgent,
    });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;

    await user.save();

    await AuditLog.log({
      userId: user._id,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: user._id,
      description: "Profile updated",
      ipAddress,
      userAgent,
      metadata: { fields: Object.keys(req.body) },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/login-history:
 *   get:
 *     summary: Get login history
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Login history
 */
exports.getLoginHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("loginHistory");
    res.json({ data: user.loginHistory || [] });
  } catch (error) {
    console.error("Get login history error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and end session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    // Deactivate the session
    if (token) {
      await Session.findOneAndUpdate(
        { token, isActive: true },
        { 
          isActive: false,
          logoutAt: new Date()
        }
      );
    }

    // Emit session update via Socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("userOffline", { 
        userId: req.user._id,
        role: req.user.role 
      });
    }

    await AuditLog.log({
      userId: req.user._id,
      action: "LOGOUT",
      targetType: "User",
      targetId: req.user._id,
      description: "User logged out",
      ipAddress,
      userAgent,
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
};

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get active sessions for current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.user._id,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).select("-token").sort({ lastActivity: -1 });

    res.json({ data: sessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Terminate a specific session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session terminated
 */
exports.terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.isActive = false;
    session.logoutAt = new Date();
    await session.save();

    res.json({ message: "Session terminated successfully" });
  } catch (error) {
    console.error("Terminate session error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = exports;
