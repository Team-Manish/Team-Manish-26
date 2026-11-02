const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Default role hierarchy mapping: higher roles inherit permissions of lower roles
const DEFAULT_ROLE_HIERARCHY = {
  admin: ["admin", "moderator", "teacher", "parent", "user"],
  moderator: ["moderator", "user"],
  teacher: ["teacher"],
  parent: ["parent"],
  user: ["user"],
};

/**
 * Audit logger helper for recording authorization decisions and security failures
 */
const logSecurityEvent = (level, eventType, message, req, extra = {}) => {
  const logPayload = {
    timestamp: new Date().toISOString(),
    level,
    eventType,
    message,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress || "unknown",
    ...extra,
  };

  if (level === "error" || level === "warn") {
    console.warn(`[SECURITY AUDIT] ${eventType}: ${message}`, JSON.stringify(logPayload));
  }
};

/**
 * Sanitizes user document to prevent leakage of sensitive fields (password, __v)
 */
const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const rawObj = typeof userDoc.toObject === "function" ? userDoc.toObject({ getters: true }) : { ...userDoc };
  delete rawObj.password;
  delete rawObj.__v;
  return rawObj;
};

/**
 * Reusable Factory Function for Express Role-Based Access Control Middleware
 *
 * @param {string|string[]} requiredRoles - Single role or array of roles permitted to access the route
 * @param {Object} [options={}] - Custom configuration options
 * @param {Object} [options.roleHierarchy] - Custom role hierarchy mapping
 * @param {Function} [options.userFetcher] - Custom user fetcher function (for testing / decoupling)
 * @returns {Function} Express middleware function
 */
const authorize = (requiredRoles, options = {}) => {
  // 1. Input Validation for Configuration Parameters
  if (requiredRoles === undefined || requiredRoles === null) {
    throw new TypeError("RBAC Middleware Error: 'requiredRoles' parameter is required.");
  }

  let rolesList = [];
  if (typeof requiredRoles === "string") {
    rolesList = requiredRoles.trim() ? [requiredRoles.trim()] : [];
  } else if (Array.isArray(requiredRoles)) {
    rolesList = requiredRoles.map((r) => (typeof r === "string" ? r.trim() : "")).filter(Boolean);
  }

  if (rolesList.length === 0) {
    throw new TypeError("RBAC Middleware Error: 'requiredRoles' must be a non-empty string or array of non-empty strings.");
  }

  const roleHierarchy = options.roleHierarchy || DEFAULT_ROLE_HIERARCHY;
  const userFetcher = options.userFetcher || (async (id) => await User.findById(id).select("-password"));

  return async (req, res, next) => {
    try {
      // 2. JWT Validation and Decoding
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (authHeader) {
        if (!authHeader.startsWith("Bearer ")) {
          logSecurityEvent("warn", "AUTH_MALFORMED_HEADER", "Authorization header must be formatted as 'Bearer <token>'", req);
          return res.status(401).json({
            success: false,
            error: "Unauthorized",
            message: "Unauthorized: Invalid Authorization header format. Expected 'Bearer <token>'.",
          });
        }
        token = authHeader.substring(7).trim();
      } else if (req.cookies && req.cookies["auth-token"]) {
        token = req.cookies["auth-token"];
      }

      if (!token) {
        logSecurityEvent("warn", "AUTH_MISSING_TOKEN", "No authentication token provided in request", req);
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Unauthorized: Missing authentication token.",
        });
      }

      let decoded;
      try {
        const jwtSecret = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";
        decoded = jwt.verify(token, jwtSecret);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          logSecurityEvent("warn", "AUTH_TOKEN_EXPIRED", "JWT token has expired", req);
          return res.status(401).json({
            success: false,
            error: "Unauthorized",
            message: "Unauthorized: Authentication token has expired.",
          });
        }
        logSecurityEvent("warn", "AUTH_INVALID_TOKEN", `Invalid JWT token: ${err.message}`, req);
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Unauthorized: Invalid authentication token.",
        });
      }

      const userId = decoded.id || decoded.sub || decoded.userId;
      if (!userId) {
        logSecurityEvent("warn", "AUTH_MISSING_CLAIM", "JWT payload missing user identifier claim", req);
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Unauthorized: Invalid token payload.",
        });
      }

      // 3. User Database Retrieval & Status Verification
      let user;
      try {
        user = await userFetcher(userId);
      } catch (dbErr) {
        logSecurityEvent("error", "AUTH_DB_ERROR", `Database query error: ${dbErr.message}`, req);
        return res.status(500).json({
          success: false,
          error: "Internal Server Error",
          message: "Internal server error during user retrieval.",
        });
      }

      if (!user) {
        logSecurityEvent("warn", "AUTH_USER_NOT_FOUND", `User ID '${userId}' not found in database`, req, { userId });
        return res.status(404).json({
          success: false,
          error: "Not Found",
          message: "Not Found: User account does not exist.",
        });
      }

      // Server-Side Session Invalidation Verification (Phase 3A: Token Versioning)
      const userVersion = user.tokenVersion || 0;
      const tokenVersion = decoded.tokenVersion || 0;
      if (tokenVersion < userVersion) {
        logSecurityEvent("warn", "AUTH_SESSION_REVOKED", `Session invalidated due to password reset for user '${userId}'`, req, { userId });
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Unauthorized: Session has been invalidated due to a password reset. Please log in again.",
        });
      }

      const userStatus = user.status || "active";
      if (userStatus !== "active") {
        logSecurityEvent("warn", "AUTH_INACTIVE_ACCOUNT", `User '${userId}' account is in '${userStatus}' state`, req, { userId, userStatus });
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: `Forbidden: Account is inactive or ${userStatus}.`,
        });
      }

      // 4. Role Comparison and Access Enforcement
      const userAssignedRoles = Array.isArray(user.roles)
        ? user.roles
        : [user.role || "user"];

      // Expand user permissions based on role hierarchy
      const effectivePermissions = new Set();
      userAssignedRoles.forEach((role) => {
        effectivePermissions.add(role);
        const inherited = roleHierarchy[role];
        if (Array.isArray(inherited)) {
          inherited.forEach((inheritedRole) => effectivePermissions.add(inheritedRole));
        }
      });

      const isAuthorized = rolesList.some((reqRole) => effectivePermissions.has(reqRole));

      if (!isAuthorized) {
        logSecurityEvent("warn", "AUTH_INSUFFICIENT_PERMISSIONS", `User '${userId}' with roles [${userAssignedRoles.join(", ")}] attempted to access route requiring [${rolesList.join(", ")}]`, req, {
          userId,
          userRoles: userAssignedRoles,
          requiredRoles: rolesList,
        });
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Forbidden: Insufficient permissions to access this resource.",
        });
      }

      // 5. Attach Sanitized User to Request Object and Proceed
      req.user = sanitizeUser(user);
      next();
    } catch (unexpectedErr) {
      logSecurityEvent("error", "AUTH_UNEXPECTED_ERROR", unexpectedErr.message, req);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Internal server error during authorization.",
      });
    }
  };
};

module.exports = {
  authorize,
  sanitizeUser,
  DEFAULT_ROLE_HIERARCHY,
};
