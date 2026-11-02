const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const User = require("../models/User");
const Student = require("../models/Student");

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

module.exports = router;

