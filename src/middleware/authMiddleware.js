const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated. Please contact admin." });
    }

    // For providers, check if approved
    if (user.role === "provider" && !user.isApproved) {
      return res.status(403).json({ message: "Account is pending approval." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
};

/**
 * Provider or Admin middleware
 */
const providerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "provider")) {
    next();
  } else {
    return res.status(403).json({ message: "Access denied. Provider or Admin only." });
  }
};

module.exports = { protect, adminOnly, providerOrAdmin };
