const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const Student = require("../models/Student");
const User = require("../models/User");
const AcademicProgress = require("../models/AcademicProgress");

// Restrict all routes in this router exclusively to verified parent user accounts
router.use(authorize("parent", {
  roleHierarchy: {
    parent: ["parent"],
    admin: ["admin"],
  },
}));

// GET /api/parent/children - Parent Children Dashboard
router.get("/children", async (req, res) => {
  try {
    const parentUser = req.user;
    const isParent = parentUser.role === "parent";

    let filter = {};
    if (isParent) {
      const linkedList = Array.isArray(parentUser.linkedStudentIds) ? parentUser.linkedStudentIds : [];
      filter = { studentId: { $in: linkedList } };
    }

    const children = await Student.find(filter);
    res.status(200).json({
      success: true,
      message: "Parent Portal: Children Summary",
      count: children.length,
      user: req.user,
      children,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

// GET /api/parent/child-progress/:studentId - Parents view academic progress of linked children
router.get("/child-progress/:studentId", async (req, res) => {
  try {
    const targetStudentId = req.params.studentId.trim();
    const parentUser = req.user;
    const isParent = parentUser.role === "parent";

    if (isParent) {
      const linkedList = Array.isArray(parentUser.linkedStudentIds) ? parentUser.linkedStudentIds : [];
      if (!linkedList.includes(targetStudentId)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Forbidden: Parent account is not linked to this student.",
        });
      }
    }

    const studentDoc = await Student.findOne({
      $or: [{ studentId: targetStudentId }, { email: targetStudentId.toLowerCase() }],
    });

    if (!studentDoc) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Student with ID '${targetStudentId}' not found.`,
      });
    }

    const progressRecords = await AcademicProgress.find({ studentId: studentDoc.studentId });

    res.status(200).json({
      success: true,
      student: studentDoc,
      progressCount: progressRecords.length,
      progressRecords,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
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

