const AuditLog = require("../models/AuditLog");

/**
 * Audit Logger Middleware
 * Automatically logs actions to the audit log
 */

// Get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Create audit log entry
 */
const createAuditLog = async (userId, action, targetType, targetId, description, req, status = "SUCCESS", metadata = {}) => {
  try {
    await AuditLog.create({
      userId,
      action,
      targetType,
      targetId,
      description,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status,
      metadata,
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
};

/**
 * Audit middleware factory
 * @param {string} action - The action type
 * @param {string} targetType - The target type (User, Child, Vaccination, etc.)
 * @param {function} getTargetId - Optional function to extract target ID from request
 */
const auditMiddleware = (action, targetType, getTargetId = null) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    
    res.send = function(body) {
      // Determine status based on response status code
      const status = res.statusCode >= 200 && res.statusCode < 400 ? "SUCCESS" : "FAILED";
      
      // Extract target ID if function provided
      let targetId = null;
      if (getTargetId) {
        try {
          targetId = getTargetId(req, res);
        } catch (e) {
          console.error("Error getting target ID:", e);
        }
      }

      // Create audit log asynchronously
      if (req.user && req.user._id) {
        createAuditLog(
          req.user._id,
          action,
          targetType,
          targetId,
          `${action} performed on ${targetType}`,
          req,
          status,
          { method: req.method, path: req.path }
        ).catch(console.error);
      }

      // Call original send
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Manual audit log function for specific actions
 */
const logAction = async (userId, action, targetType, targetId, description, req, status = "SUCCESS", metadata = {}) => {
  await createAuditLog(userId, action, targetType, targetId, description, req, status, metadata);
};

module.exports = {
  auditMiddleware,
  logAction,
  createAuditLog,
};
