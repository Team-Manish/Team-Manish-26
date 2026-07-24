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

module.exports = router;
