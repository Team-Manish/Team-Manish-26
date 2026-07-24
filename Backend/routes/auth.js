const express = require("express");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

// Rate limiting for login endpoint ONLY
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/login",
  loginLimiter,
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.param,
            message: err.msg,
          })),
        });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const expiresIn = process.env.JWT_EXPIRES_IN || "24h";
      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET || "fallback-secret-key-use-env-vars",
        {
          expiresIn,
        }
      );

      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));

      // Set JWT in HttpOnly secure cookie
      res.cookie("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Login error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Public User Registration Flow
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.param,
            message: err.msg,
          })),
        });
      }

      const { email, password, role } = req.body;

      // Privilege escalation check: block non-admin users from assigning non-default role
      const isReqAdmin = req.user && req.user.role === "admin";
      if (role && role !== "user" && !isReqAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Non-admin users cannot assign non-default roles.",
        });
      }

      const assignedRole = isReqAdmin && role ? role : "user";

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      const user = new User({
        email,
        password,
        role: assignedRole,
      });

      await user.save();

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.name === "MongoServerError" || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Registration error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Admin-Exclusive Creation Flow
router.post(
  "/admin/create-user",
  verifyToken,
  requireRole("admin"),
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((err) => ({
            field: err.param,
            message: err.msg,
          })),
        });
      }

      const { email, password, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      const user = new User({
        email,
        password,
        role: role || "user",
      });

      await user.save();

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.name === "MongoServerError" || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Admin create-user error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

router.post("/logout", (req, res) => {
  // Clear auth and CSRF cookies
  res.clearCookie("auth-token");
  res.clearCookie("XSRF-TOKEN");
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Endpoint to check current user session
router.get("/me", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = router;

