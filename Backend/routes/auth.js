const express = require("express");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const User = require("../models/User");
const Student = require("../models/Student");
const { verifyToken, requireRole } = require("../middleware/auth");
const { sendRegistrationEmail, resendCredentialsEmail, sendPasswordResetEmail } = require("../services/emailService");

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

// Admin-Exclusive User Registration Flow (Teacher, Parent, Student, etc.)
router.post(
  "/admin/create-user",
  verifyToken,
  requireRole("admin"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("role")
      .isIn(["teacher", "parent", "student", "user", "admin"])
      .withMessage("Invalid role selected. Allowed roles: teacher, parent, student, user, admin"),
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
          message: errors.array().map((err) => err.msg).join(", "),
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
        department: department ? department.trim() : (role === "teacher" ? "General Academics" : undefined),
        assignedStudentIds: Array.isArray(assignedStudentIds) ? assignedStudentIds : [],
        linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : (typeof linkedStudentIds === "string" ? linkedStudentIds.split(",").map(s => s.trim()).filter(Boolean) : []),
      });

      await user.save();

      // Task-3: Notify new user of their account by sending email with login details (stub/mock for MVP)
      const emailNotification = await sendRegistrationEmail({
        name: user.name,
        email: user.email,
        role: user.role,
        password,
        userId: user.userId,
      });

      res.status(201).json({
        success: true,
        message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} account created successfully by administrator. Credentials notification email sent.`,
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          linkedStudentIds: user.linkedStudentIds,
        },
        emailNotification: {
          status: "sent",
          recipient: user.email,
          messageId: emailNotification.messageId,
          stubMessage: "Email notification with login details dispatched successfully (Mock MVP)",
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
        message: "Internal server error during user registration",
      });
    }
  }
);

// Admin Resend Login Credentials Endpoint (Task-3)
router.post(
  "/admin/resend-credentials",
  verifyToken,
  requireRole("admin"),
  [
    body("email").isEmail().withMessage("Valid email address is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map((err) => err.msg).join(", "),
        });
      }

      const { email, password } = req.body;
      const normEmail = email.trim().toLowerCase();

      const user = await User.findOne({ email: normEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User account for email '${email}' not found.`,
        });
      }

      const emailResult = await resendCredentialsEmail({
        name: user.name || user.username,
        email: user.email,
        role: user.role,
        userId: user.userId,
        password: password || "[REDACTED_PREVIOUS_PASSWORD]",
      });

      res.status(200).json({
        success: true,
        message: `Account credentials email resent successfully to ${user.email} (Mock MVP Service)`,
        emailNotification: emailResult,
      });
    } catch (error) {
      console.error("Resend credentials error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error while resending user credentials email",
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

/**
 * POST /api/auth/forgot-password (Task 1 & Task 2)
 * Request password reset token & send email notification link.
 */
router.post(
  "/forgot-password",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map((err) => err.msg).join(", "),
          errors: errors.array().map((err) => ({ field: err.param, message: err.msg })),
        });
      }

      const { email } = req.body;
      const normEmail = email.trim().toLowerCase();

      const user = await User.findOne({ email: normEmail });
      if (!user) {
        return res.status(200).json({
          success: true,
          message: "If an account with that email exists, a password reset link has been sent.",
        });
      }

      // Generate cryptographically secure token and 1-hour expiration
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 3600000); // 1 hour

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetExpires;
      user._adminOverrideRole = true;
      await user.save();

      // Dispatch password reset email notification (Mock/Stub for MVP)
      const emailResult = await sendPasswordResetEmail({
        name: user.name || user.username,
        email: user.email,
        resetToken,
      });

      res.status(200).json({
        success: true,
        message: "Password reset link has been dispatched to your email address.",
        resetToken,
        resetUrl: emailResult.resetLink,
        emailNotification: emailResult,
      });
    } catch (error) {
      console.error("Forgot password request error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error processing password reset request",
      });
    }
  }
);

/**
 * GET /api/auth/validate-reset-token/:token (Task 3)
 * Validate time-limited reset token.
 */
router.get("/validate-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Password reset link is invalid or has expired.",
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      email: user.email,
      message: "Reset token is valid.",
    });
  } catch (error) {
    console.error("Validate reset token error:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error validating reset token",
    });
  }
});

/**
 * POST /api/auth/reset-password (Task 3 & Task 4)
 * Validate reset token, hash new password, clear token, and confirm update in DB.
 */
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map((err) => err.msg).join(", "),
          errors: errors.array().map((err) => ({ field: err.param, message: err.msg })),
        });
      }

      const { token, password } = req.body;

      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Password reset token is invalid or has expired.",
        });
      }

      // Securely update password (bcrypt hash applied in pre-save hook)
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user._adminOverrideRole = true;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Password updated successfully! You can now log in with your new password.",
      });
    } catch (error) {
      console.error("Reset password error:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error during password reset",
      });
    }
  }
);

module.exports = router;



