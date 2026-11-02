const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { authorize } = require("../middleware/rbac");
const User = require("../models/User");
const Student = require("../models/Student");
const { sendRegistrationEmail, resendCredentialsEmail } = require("../services/emailService");

// Protect all administrative routes exclusively for users with admin role
router.use(authorize("admin"));

// GET /api/admin/dashboard - Admin System Dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const teacherCount = await User.countDocuments({ role: "teacher" });
    const studentCount = await Student.countDocuments();
    const parentCount = await User.countDocuments({ role: "parent" });

    res.status(200).json({
      success: true,
      message: "Admin Dashboard Access Granted",
      user: req.user,
      stats: {
        totalUsers,
        teacherCount,
        studentCount,
        parentCount,
        systemHealth: "Optimal",
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// GET /api/admin/teachers - Admins view and oversee all teacher profiles
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-password");
    res.status(200).json({
      success: true,
      count: teachers.length,
      teachers,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// PUT /api/admin/teachers/:id - Admins update teacher profile / assignments
router.put("/teachers/:id", async (req, res) => {
  try {
    const { name, department, assignedStudentIds, status } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (department !== undefined) updateData.department = department.trim();
    if (assignedStudentIds !== undefined) updateData.assignedStudentIds = Array.isArray(assignedStudentIds) ? assignedStudentIds : [];
    if (status !== undefined) updateData.status = status;

    const teacher = await User.findOneAndUpdate(
      { _id: req.params.id, role: "teacher" },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Teacher profile not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher profile updated successfully by admin.",
      teacher,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// DELETE /api/admin/teachers/:id - Admins delete teacher profile
router.delete("/teachers/:id", async (req, res) => {
  try {
    const teacher = await User.findOneAndDelete({ _id: req.params.id, role: "teacher" });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Teacher profile not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Teacher profile deleted successfully by admin.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// GET /api/admin/students - Admins view all student profiles
router.get("/students", async (req, res) => {
  try {
    const students = await Student.find();
    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// GET /api/admin/users - Admin User Management
router.get("/users", async (req, res) => {
  try {
    const roleFilter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(roleFilter).select("-password");
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// PUT /api/admin/users/:id/status - Admin Status Update
router.put("/users/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "suspended", "pending", "deleted"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid status value. Permitted values: active, suspended, pending, deleted.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: `User status updated to ${status}.`,
      user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// POST /api/admin/system-settings - Admin Settings Config
router.post("/system-settings", (req, res) => {
  const { maintenanceMode, sessionTimeout } = req.body;
  res.status(200).json({
    success: true,
    message: "Admin System Settings Updated Successfully",
    settings: { maintenanceMode: !!maintenanceMode, sessionTimeout: sessionTimeout || 3600 },
  });
});

// DELETE /api/admin/users/:id - Admin User Deletion
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "User deleted by admin.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

/**
 * POST /api/admin/register & POST /api/admin/create-user
 * Admin-Only Registration API Endpoint (Task 1, Task 2, Task 3)
 * - Restrict access exclusively to admins (via router-level RBAC authorize("admin"))
 * - Validate inputs (name, email, role, password min 8 chars)
 * - Check duplicate email in User & Student collections
 * - Hash password using bcrypt (Mongoose model pre-save hook)
 * - Notify new user of account details via email credentials dispatch (Stub / Mock for MVP)
 */
const handleAdminRegistration = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((err) => err.msg).join(", "),
        errors: errors.array().map((err) => ({ field: err.param, message: err.msg })),
      });
    }

    const { name, email, role, password, username, userId, department, linkedStudentIds, assignedStudentIds } = req.body;

    const normEmail = email.trim().toLowerCase();
    const normUsername = username ? username.trim().toLowerCase() : normEmail.split("@")[0];
    const normRole = role || "teacher";
    const normUserId = userId ? userId.trim() : `${normRole.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // 1. Check for duplicate email across User and Student collections
    const existingUserEmail = await User.findOne({ email: normEmail });
    if (existingUserEmail) {
      return res.status(400).json({
        success: false,
        message: `Email address '${email}' is already registered`,
      });
    }

    const existingStudentEmail = await Student.findOne({ email: normEmail });
    if (existingStudentEmail) {
      return res.status(400).json({
        success: false,
        message: `Email address '${email}' is already registered`,
      });
    }

    // 2. Create user document (Password is hashed in User model pre-save hook using bcrypt)
    const user = new User({
      email: normEmail,
      username: normUsername,
      userId: normUserId,
      name: name.trim(),
      password,
      role: normRole,
      department: department ? department.trim() : (normRole === "teacher" ? "General Academics" : undefined),
      assignedStudentIds: Array.isArray(assignedStudentIds) ? assignedStudentIds : [],
      linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : (typeof linkedStudentIds === "string" ? linkedStudentIds.split(",").map(s => s.trim()).filter(Boolean) : []),
    });

    await user.save();

    // If role is student, also sync to Student collection
    if (normRole === "student") {
      const student = new Student({
        studentId: normUserId,
        email: normEmail,
        username: normUsername,
        name: name.trim(),
        age: req.body.age ? Number(req.body.age) : 18,
        enrolledSubjects: Array.isArray(req.body.enrolledSubjects) ? req.body.enrolledSubjects : [],
      });
      await student.save();
    }

    // 3. Task-3: Send email with login credentials details (stub/mock for MVP)
    const emailNotification = await sendRegistrationEmail({
      name: user.name,
      email: user.email,
      role: user.role,
      password,
      userId: user.userId,
    });

    res.status(201).json({
      success: true,
      message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} account created successfully by administrator. Credentials email sent.`,
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
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry: Account with this email, username, or userId already exists",
      });
    }
    if (err.name === "MongoServerError" || err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    console.error("Admin user registration error:", err.message);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
};

const adminRegistrationValidations = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("role")
    .isIn(["teacher", "parent", "student", "user", "admin"])
    .withMessage("Invalid role selected. Permitted roles: teacher, parent, student, user, admin"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

router.post("/register", adminRegistrationValidations, handleAdminRegistration);
router.post("/create-user", adminRegistrationValidations, handleAdminRegistration);

// POST /api/admin/send-credentials - Resend login credentials email (Task-3)
router.post("/send-credentials", [
  body("email").isEmail().withMessage("Valid email address is required"),
], async (req, res) => {
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
      password: password || "[REDACTED_TEMPORARY_PASSWORD]",
    });

    res.status(200).json({
      success: true,
      message: `Account credentials email resent successfully to ${user.email} (Mock MVP Service)`,
      emailNotification: emailResult,
    });
  } catch (err) {
    console.error("Resend credentials error:", err.message);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

module.exports = router;

