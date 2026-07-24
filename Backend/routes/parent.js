const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");

// Restrict all routes in this router exclusively to verified parent user accounts
// Custom role hierarchy ensures cross-role access from teacher or standard user roles is strictly blocked
router.use(authorize("parent", {
  roleHierarchy: {
    parent: ["parent"],
    admin: ["admin"],
  },
}));

// GET /api/parent/children - Parent Children Dashboard
router.get("/children", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Parent Portal: Children Summary",
    user: req.user,
    children: [
      { id: "STU-101", name: "Alex Smith", grade: "10th Grade", gpa: "3.8" },
      { id: "STU-102", name: "Emma Smith", grade: "7th Grade", gpa: "3.9" },
    ],
  });
});

// GET /api/parent/attendance - Parent Attendance Overview
router.get("/attendance", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Parent Portal: Attendance Report",
    user: req.user,
    attendanceRecords: [
      { childId: "STU-101", date: "2026-07-24", status: "Present" },
      { childId: "STU-102", date: "2026-07-24", status: "Present" },
    ],
  });
});

// POST /api/parent/feedback - Parent Submit Feedback
router.post("/feedback", (req, res) => {
  const { feedback } = req.body;
  res.status(201).json({
    success: true,
    message: "Parent feedback submitted successfully.",
    feedback,
  });
});

// PUT /api/parent/profile - Parent Profile Update
router.put("/profile", (req, res) => {
  const { phone } = req.body;
  res.status(200).json({
    success: true,
    message: "Parent contact profile updated.",
    phone,
  });
});

// DELETE /api/parent/notifications/:id - Parent Dismiss Notification
router.delete("/notifications/:id", (req, res) => {
  res.status(200).json({
    success: true,
    message: `Notification ${req.params.id} dismissed by parent.`,
  });
});

module.exports = router;
