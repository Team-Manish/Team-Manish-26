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

    // Strict Token Version Validation (Phase 3B: Priority 1)
    // 1. JWT must contain a valid tokenVersion claim (strictly an integer >= 0)
    // Missing, undefined, null, non-numeric, or negative claims are strictly rejected.
    if (
      decoded.tokenVersion === undefined ||
      decoded.tokenVersion === null ||
      typeof decoded.tokenVersion !== "number" ||
      !Number.isInteger(decoded.tokenVersion) ||
      decoded.tokenVersion < 0
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Unauthorized: Invalid or missing tokenVersion claim. Please log in again.",
      });
    }

    const lookupId = decoded.id || decoded.userId;
    if (!lookupId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Unauthorized: Missing user identifier claim.",
      });
    }

    try {
      const query = User.findOne({
        $or: [{ _id: lookupId }, { userId: lookupId }],
      });
      const user = query && typeof query.select === "function"
        ? await query.select("tokenVersion status")
        : await query;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Unauthorized: User account not found.",
        });
      }

      // Safe and consistent handling for legacy User documents without tokenVersion:
      const dbVersion = (typeof user.tokenVersion === "number" && Number.isInteger(user.tokenVersion))
        ? user.tokenVersion
        : 0;

      // 2. Token version must exactly equal the authenticated user's current database tokenVersion
      if (decoded.tokenVersion !== dbVersion) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Session invalidated due to password reset or token version mismatch. Please log in again.",
        });
      }
    } catch (dbErr) {
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Internal server error during session verification.",
      });
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
