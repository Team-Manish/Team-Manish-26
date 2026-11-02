const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies["auth-token"]) {
    token = req.cookies["auth-token"];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret-key-use-env-vars");

    // Server-Side Session Revocation Verification (Phase 3A: Token Versioning)
    const lookupId = decoded.id || decoded.userId;
    if (lookupId) {
      try {
        const query = User.findOne({
          $or: [{ _id: lookupId }, { userId: lookupId }],
        });
        const user = query && typeof query.select === "function"
          ? await query.select("tokenVersion status")
          : await query;

        if (user) {
          const userVersion = user.tokenVersion !== undefined ? user.tokenVersion : 0;
          const tokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
          if (tokenVersion < userVersion) {
            return res.status(401).json({
              success: false,
              message: "Session invalidated due to password reset. Please log in again.",
            });
          }
        }
      } catch (dbErr) {
        // If DB query fails, continue with decoded payload
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access is denied for this role",
      });
    }
    next();
  };
};

const { authorize } = require("./rbac");

module.exports = { verifyToken, requireRole, authorize };
