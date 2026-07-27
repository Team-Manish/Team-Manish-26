const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const Student = require("../models/Student");
const User = require("../models/User");

// Restrict all routes in this router exclusively to users with 'teacher' or 'admin' role assignment
router.use(authorize("teacher", {
  roleHierarchy: {
    teacher: ["teacher"],
    admin: ["admin"],
  },
}));

// GET /api/teacher/students - Retrieve assigned student profiles
router.get("/students", async (req, res) => {
  try {
    const teacherUser = req.user;
    const isTeacher = teacherUser.role === "teacher";

    let filter = {};
    if (isTeacher) {
      const teacherId = teacherUser.userId || teacherUser.id;
      const assignedList = Array.isArray(teacherUser.assignedStudentIds) ? teacherUser.assignedStudentIds : [];
      filter = {
        $or: [
          { assignedTeacherId: teacherId },
          { studentId: { $in: assignedList } },
        ],
      };
    }

    const students = await Student.find(filter);
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

// PUT /api/teacher/students/:studentId - Teachers update details of assigned students
router.put("/students/:studentId", async (req, res) => {
  try {
    const targetStudentId = req.params.studentId.trim();
    const teacherUser = req.user;
    const isTeacher = teacherUser.role === "teacher";

    const student = await Student.findOne({
      $or: [{ studentId: targetStudentId }, { email: targetStudentId.toLowerCase() }],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Student with identifier '${targetStudentId}' not found.`,
      });
    }

    // RBAC check: teacher can only edit assigned students
    if (isTeacher) {
      const teacherId = teacherUser.userId || teacherUser.id;
      const assignedList = Array.isArray(teacherUser.assignedStudentIds) ? teacherUser.assignedStudentIds : [];
      const isAssigned = student.assignedTeacherId === teacherId || assignedList.includes(student.studentId);

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Forbidden: Teachers can only edit details of their assigned students.",
        });
      }
    }

    const { name, age, enrolledSubjects, assignedTeacherId } = req.body;
    if (name !== undefined) student.name = name.trim();
    if (age !== undefined) student.age = Number(age);
    if (enrolledSubjects !== undefined) student.enrolledSubjects = Array.isArray(enrolledSubjects) ? enrolledSubjects : [];
    if (assignedTeacherId !== undefined) student.assignedTeacherId = assignedTeacherId.trim();

    await student.save();

    // Synchronize changes back to User document if present
    await User.findOneAndUpdate(
      { $or: [{ userId: student.studentId }, { email: student.email }] },
      {
        $set: {
          name: student.name,
          age: student.age,
          enrolledSubjects: student.enrolledSubjects,
          assignedTeacherId: student.assignedTeacherId,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Student details updated successfully for student '${student.studentId}'.`,
      student,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

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

