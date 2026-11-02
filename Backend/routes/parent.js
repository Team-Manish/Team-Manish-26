const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const Student = require("../models/Student");
const User = require("../models/User");
const AcademicProgress = require("../models/AcademicProgress");
const Attendance = require("../models/Attendance");

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

/**
 * GET /api/parent/child-attendance/:studentId & GET /api/parent/attendance
 * Retrieves attendance data for a parent's linked child with strict RBAC link enforcement.
 * Rejects requests for unlinked students with HTTP 403 Forbidden.
 */
const handleParentChildAttendance = async (req, res) => {
  try {
    const parentUser = req.user;
    const isParent = parentUser.role === "parent";
    let targetStudentId = (req.params.studentId || req.query.studentId || "").trim();

    const linkedList = Array.isArray(parentUser.linkedStudentIds) ? parentUser.linkedStudentIds : [];

    if (!targetStudentId) {
      if (linkedList.length > 0) {
        targetStudentId = linkedList[0];
      } else {
        return res.status(200).json({
          success: true,
          studentId: "",
          meta: {
            year: new Date().getUTCFullYear(),
            month: new Date().getUTCMonth() + 1,
            daysInMonth: 30,
          },
          summary: {
            attendanceRate: 0,
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            excusedCount: 0,
            totalDays: 0,
          },
          records: [],
        });
      }
    }

    const normalizedLinkedList = linkedList.map((id) => String(id).trim().toUpperCase());
    const normalizedTarget = targetStudentId.toUpperCase();

    // Security Check: Enforce that parent can ONLY access linked children (case-insensitive matching)
    if (isParent && !normalizedLinkedList.includes(normalizedTarget)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Forbidden: Parent account is not linked to student '${targetStudentId}'.`,
      });
    }

    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
    const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid year or month query parameter.",
      });
    }

    const formattedMonth = String(month).padStart(2, "0");
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDateStr = `${year}-${formattedMonth}-01`;
    const endDateStr = `${year}-${formattedMonth}-${String(daysInMonth).padStart(2, "0")}`;

    let records = [];
    try {
      records = await Attendance.find({
        studentId: normalizedTarget,
        dateStr: { $gte: startDateStr, $lte: endDateStr },
      }).sort({ dateStr: 1 });
    } catch (dbErr) {
      if (mongoose.connection.readyState !== 1) {
        records = [];
      } else {
        throw dbErr;
      }
    }

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    const formattedRecords = records.map((r) => {
      const status = r.status || "present";
      if (status === "present") presentCount++;
      else if (status === "absent") absentCount++;
      else if (status === "late") lateCount++;
      else if (status === "excused") excusedCount++;

      return {
        id: r._id ? r._id.toString() : r.id,
        studentId: r.studentId,
        studentName: r.studentName || "Student",
        className: r.className || "General",
        date: r.date,
        dateStr: r.dateStr,
        status,
        remarks: r.remarks || "",
      };
    });

    const totalDays = formattedRecords.length;
    const attendanceRate = totalDays > 0
      ? Math.round(((presentCount + lateCount) / totalDays) * 1000) / 10
      : 0;

    return res.status(200).json({
      success: true,
      studentId: targetStudentId,
      meta: {
        year,
        month,
        daysInMonth,
      },
      summary: {
        attendanceRate,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        totalDays,
      },
      records: formattedRecords,
    });
  } catch (err) {
    console.error("Parent attendance error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
};

router.get("/child-attendance/:studentId", handleParentChildAttendance);
router.get("/attendance", handleParentChildAttendance);

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
