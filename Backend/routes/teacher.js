const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");

// Restrict all routes in this router exclusively to users with 'teacher' role assignment
// Custom role hierarchy ensures cross-role access from other non-teacher roles is strictly blocked
router.use(authorize("teacher", {
  roleHierarchy: {
    teacher: ["teacher"],
    admin: ["admin"],
  },
}));

// GET /api/teacher/classes - Teacher Classes List
router.get("/classes", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Teacher Portal: Classes Overview",
    user: req.user,
    classes: [
      { id: "CS101", name: "Computer Science Foundations", studentsCount: 28 },
      { id: "MATH201", name: "Advanced Mathematics", studentsCount: 22 },
    ],
  });
});

// POST /api/teacher/grades - Teacher Grade Assignment
router.post("/grades", (req, res) => {
  const { studentId, subject, grade } = req.body;
  if (!studentId || !subject || !grade) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Missing required fields: studentId, subject, grade.",
    });
  }

  res.status(201).json({
    success: true,
    message: "Grade recorded successfully by teacher.",
    record: {
      studentId,
      subject,
      grade,
      gradedBy: req.user.email,
      timestamp: new Date().toISOString(),
    },
  });
});

// PUT /api/teacher/grades/:id - Teacher Update Grade
router.put("/grades/:id", (req, res) => {
  const { grade } = req.body;
  res.status(200).json({
    success: true,
    message: `Grade record ${req.params.id} updated to ${grade} by teacher.`,
  });
});

// POST /api/teacher/progress - Teacher Progress Tracking Endpoint
router.post("/progress", (req, res) => {
  const { progressPercentage, taskId, statusIdentifier, timestamp, message, metadata } = req.body;

  if (progressPercentage === undefined || typeof progressPercentage !== "number" || progressPercentage < 0 || progressPercentage > 100) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Invalid or missing 'progressPercentage'. Must be a number between 0 and 100.",
    });
  }

  if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Invalid or missing 'taskId'. Must be a non-empty string.",
    });
  }

  const validStatuses = ["pending", "in_progress", "completed", "blocked"];
  if (!statusIdentifier || !validStatuses.includes(statusIdentifier)) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: `Invalid or missing 'statusIdentifier'. Allowed values: ${validStatuses.join(", ")}.`,
    });
  }

  const progressRecord = {
    id: `PROG-${Date.now()}`,
    taskId: taskId.trim(),
    progressPercentage,
    statusIdentifier,
    message: message ? String(message).trim() : "",
    timestamp: timestamp || new Date().toISOString(),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    updatedBy: req.user ? req.user.email : "system",
  };

  res.status(201).json({
    success: true,
    message: `Progress update of ${progressPercentage}% recorded for task ${taskId}.`,
    data: progressRecord,
  });
});

module.exports = router;
