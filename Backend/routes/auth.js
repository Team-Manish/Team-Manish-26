const express = require("express");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Student = require("../models/Student");
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

/**
 * Helper to validate unique credentials (email, username, userId) across User and Student collections.
 * Returns an error message string if duplicate found, or null if all credentials are clear.
 */
async function checkUniqueCredentials({ email, username, userId }) {
  if (email) {
    const normEmail = email.trim().toLowerCase();
    const existingUserEmail = await User.findOne({ email: normEmail });
    if (existingUserEmail) return `Email address '${email}' is already registered`;
    const existingStudentEmail = await Student.findOne({ email: normEmail });
    if (existingStudentEmail) return `Email address '${email}' is already registered`;
  }

  if (username) {
    const normUsername = username.trim().toLowerCase();
    const existingUserUsername = await User.findOne({ username: normUsername });
    if (existingUserUsername) return `Username '${username}' is already in use`;
    const existingStudentUsername = await Student.findOne({ username: normUsername });
    if (existingStudentUsername) return `Username '${username}' is already in use`;
  }

  if (userId) {
    const normUserId = userId.trim();
    const existingUserUserId = await User.findOne({ userId: normUserId });
    if (existingUserUserId) return `User ID '${userId}' is already in use`;
    const existingStudentId = await Student.findOne({ studentId: normUserId });
    if (existingStudentId) return `User ID '${userId}' is already in use`;
  }

  return null;
}

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

      const user = await User.findOne({ email: email.trim().toLowerCase() });
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
          userId: user.userId,
          email: user.email,
          username: user.username,
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
          userId: user.userId,
          email: user.email,
          username: user.username,
          role: user.role,
          name: user.name,
          department: user.department,
          assignedStudentIds: user.assignedStudentIds,
          linkedStudentIds: user.linkedStudentIds,
          assignedTeacherId: user.assignedTeacherId,
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

// Public Student Self-Registration Endpoint
router.post(
  "/register-student",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    body("name").notEmpty().withMessage("Name is required"),
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

      const { email, username, userId, password, name, age, enrolledSubjects, assignedTeacherId } = req.body;

      const normEmail = email.trim().toLowerCase();
      const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
      const normUserId = userId ? userId.trim() : `STU-${Date.now().toString(36).toUpperCase()}`;

      const duplicateError = await checkUniqueCredentials({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
      });

      if (duplicateError) {
        return res.status(400).json({
          success: false,
          message: duplicateError,
        });
      }

      // Create User Account with student role
      const user = new User({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
        password,
        name: name.trim(),
        role: "student",
        age: age ? Number(age) : 18,
        enrolledSubjects: Array.isArray(enrolledSubjects) ? enrolledSubjects : [],
        assignedTeacherId: assignedTeacherId ? assignedTeacherId.trim() : undefined,
      });

      await user.save();

      // Synchronize with Student collection in MongoDB Atlas
      const student = new Student({
        studentId: normUserId,
        email: normEmail,
        username: normUsername,
        name: name.trim(),
        age: age ? Number(age) : 18,
        enrolledSubjects: Array.isArray(enrolledSubjects) ? enrolledSubjects : [],
        assignedTeacherId: assignedTeacherId ? assignedTeacherId.trim() : undefined,
      });

      await student.save();

      res.status(201).json({
        success: true,
        message: "Student account created successfully",
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        const key = Object.keys(error.keyPattern || {})[0] || "credential";
        return res.status(400).json({
          success: false,
          message: `Duplicate entry: ${key} already exists in database`,
        });
      }
      if (error.name === "MongoServerError" || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Student self-registration error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error during student registration",
      });
    }
  }
);

// Public User Registration Flow (Fallback / Generic)
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

      const { email, username, userId, password, role, name } = req.body;

      // Privilege escalation check: block non-admin users from assigning non-default role
      const isReqAdmin = req.user && req.user.role === "admin";
      if (role && role !== "user" && role !== "student" && !isReqAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Non-admin users cannot assign non-default roles.",
        });
      }

      const assignedRole = role === "student" ? "student" : (isReqAdmin && role ? role : "user");
      const normEmail = email.trim().toLowerCase();
      const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
      const normUserId = userId ? userId.trim() : `${assignedRole.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const duplicateError = await checkUniqueCredentials({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
      });

      if (duplicateError) {
        return res.status(400).json({
          success: false,
          message: duplicateError,
        });
      }

      const user = new User({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
        name: name ? name.trim() : normUsername,
        password,
        role: assignedRole,
      });

      await user.save();

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Account with duplicate email, username, or userId already exists",
        });
      }
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

// Admin-Exclusive Teacher Registration Flow
router.post(
  "/admin/register-teacher",
  verifyToken,
  requireRole("admin"),
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    body("name").notEmpty().withMessage("Teacher name is required"),
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

      const { email, username, userId, password, name, department, assignedStudentIds } = req.body;

      const normEmail = email.trim().toLowerCase();
      const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
      const normUserId = userId ? userId.trim() : `TCH-${Date.now().toString(36).toUpperCase()}`;

      const duplicateError = await checkUniqueCredentials({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
      });

      if (duplicateError) {
        return res.status(400).json({
          success: false,
          message: duplicateError,
        });
      }

      const user = new User({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
        name: name.trim(),
        password,
        role: "teacher",
        department: department ? department.trim() : "General Academics",
        assignedStudentIds: Array.isArray(assignedStudentIds) ? assignedStudentIds : [],
      });

      await user.save();

      res.status(201).json({
        success: true,
        message: "Teacher account created successfully by administrator",
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          assignedStudentIds: user.assignedStudentIds,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Duplicate entry: Teacher email, username, or userId already exists",
        });
      }
      if (error.name === "MongoServerError" || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Admin register-teacher error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error during teacher registration",
      });
    }
  }
);

// Admin-Exclusive Parent Registration Flow
router.post(
  "/admin/register-parent",
  verifyToken,
  requireRole("admin"),
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    body("name").notEmpty().withMessage("Parent name is required"),
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

      const { email, username, userId, password, name, linkedStudentIds } = req.body;

      const normEmail = email.trim().toLowerCase();
      const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
      const normUserId = userId ? userId.trim() : `PRN-${Date.now().toString(36).toUpperCase()}`;

      const duplicateError = await checkUniqueCredentials({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
      });

      if (duplicateError) {
        return res.status(400).json({
          success: false,
          message: duplicateError,
        });
      }

      const user = new User({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
        name: name.trim(),
        password,
        role: "parent",
        linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [],
      });

      await user.save();

      res.status(201).json({
        success: true,
        message: "Parent account created successfully by administrator",
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          linkedStudentIds: user.linkedStudentIds,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Duplicate entry: Parent email, username, or userId already exists",
        });
      }
      if (error.name === "MongoServerError" || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Admin register-parent error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error during parent registration",
      });
    }
  }
);

// Admin-Exclusive Generic Creation Flow (Legacy compatibility)
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

      const { email, username, userId, password, role, name, department, assignedStudentIds, linkedStudentIds } = req.body;

      const normEmail = email.trim().toLowerCase();
      const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
      const normUserId = userId ? userId.trim() : `${(role || "USR").substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const duplicateError = await checkUniqueCredentials({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
      });

      if (duplicateError) {
        return res.status(400).json({
          success: false,
          message: duplicateError,
        });
      }

      const user = new User({
        email: normEmail,
        username: normUsername,
        userId: normUserId,
        name: name ? name.trim() : normUsername,
        password,
        role: role || "user",
        department: department ? department.trim() : undefined,
        assignedStudentIds: Array.isArray(assignedStudentIds) ? assignedStudentIds : [],
        linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [],
      });

      await user.save();

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "User with this email, username, or userId already exists",
        });
      }
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


