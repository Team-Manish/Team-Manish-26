const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const User = require("../models/User");

// Protect all administrative routes exclusively for users with admin role
router.use(authorize("admin"));

// GET /api/admin/dashboard - Admin System Dashboard
router.get("/dashboard", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin Dashboard Access Granted",
    user: req.user,
    stats: {
      totalUsers: 150,
      activeSessions: 12,
      systemHealth: "Optimal",
    },
  });
});

// GET /api/admin/users - Admin User Management
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
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

module.exports = router;
