const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const Attendance = require("../models/Attendance");

// Protect attendance endpoints exclusively for admin and teacher roles
router.use(authorize(["admin", "teacher"]));

/**
 * Normalizes input date into consistent UTC calendar day representation (YYYY-MM-DD at 00:00:00.000Z)
 * to prevent date shifting across timezones.
 */
function parseCalendarDate(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      return { date, dateStr, year, month, day };
    }
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return { date, dateStr, year: parseInt(year, 10), month: parseInt(month, 10), day: parseInt(day, 10) };
}

/**
 * GET /api/attendance/heatmap
 * Query params: year (YYYY), month (1-12), viewMode ("school" | "class"), className, school
 * Enforces role-scoped visibility: Teachers see only assigned students.
 */
router.get("/heatmap", async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
    const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;
    const viewMode = req.query.viewMode === "class" ? "class" : "school";
    const className = req.query.className ? String(req.query.className).trim() : "";
    const school = req.query.school ? String(req.query.school).trim() : "Main Campus";

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

    // Base match filter
    const matchFilter = {
      dateStr: { $gte: startDateStr, $lte: endDateStr },
    };

    if (viewMode === "class" && className) {
      matchFilter.className = className;
    }
    if (school) {
      matchFilter.school = school;
    }

    // Teacher authorization: Scope queries exclusively to assigned students
    const isTeacher = req.user.role === "teacher";
    if (isTeacher) {
      const assignedIds = Array.isArray(req.user.assignedStudentIds) ? req.user.assignedStudentIds : [];
      if (assignedIds.length === 0) {
        return res.status(200).json({
          success: true,
          meta: {
            year,
            month,
            daysInMonth,
            viewMode,
            className: viewMode === "class" ? className : "School-Wide",
            school,
            availableClasses: [],
          },
          summary: {
            overallAttendanceRate: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalExcused: 0,
            totalRecords: 0,
            activeDaysCount: 0,
          },
          dailyData: [],
        });
      }
      matchFilter.studentId = { $in: assignedIds };
    }

    // Execute aggregation
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: "$dateStr",
          totalStudents: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
          excused: {
            $sum: { $cond: [{ $eq: ["$status", "excused"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalStudents: 1,
          present: 1,
          absent: 1,
          late: 1,
          excused: 1,
          attendanceRate: {
            $cond: [
              { $gt: ["$totalStudents", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $add: ["$present", "$late"] }, "$totalStudents"] },
                      100,
                    ],
                  },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { date: 1 } },
    ];

    const rawAggregation = await Attendance.aggregate(pipeline);

    // Retrieve available classes accessible to the requesting user
    const classQueryFilter = isTeacher
      ? { studentId: { $in: req.user.assignedStudentIds || [] } }
      : {};
    let availableClasses = await Attendance.distinct("className", classQueryFilter);
    if (!availableClasses || !Array.isArray(availableClasses)) {
      availableClasses = [];
    }

    // Compute month summary statistics
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;
    let totalRecords = 0;

    rawAggregation.forEach((day) => {
      totalPresent += day.present;
      totalAbsent += day.absent;
      totalLate += day.late;
      totalExcused += day.excused;
      totalRecords += day.totalStudents;
    });

    const overallAttendanceRate =
      totalRecords > 0
        ? Math.round(((totalPresent + totalLate) / totalRecords) * 1000) / 10
        : 0;

    return res.status(200).json({
      success: true,
      meta: {
        year,
        month,
        daysInMonth,
        viewMode,
        className: viewMode === "class" ? className : "School-Wide",
        school,
        availableClasses: availableClasses.sort(),
      },
      summary: {
        overallAttendanceRate,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        totalRecords,
        activeDaysCount: rawAggregation.length,
      },
      dailyData: rawAggregation,
    });
  } catch (err) {
    console.error("Attendance heatmap error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

/**
 * GET /api/attendance/daily-details
 * Query params: date (YYYY-MM-DD), viewMode ("school" | "class"), className
 * Enforces role-scoped visibility: Teachers see only assigned students.
 */
router.get("/daily-details", async (req, res) => {
  try {
    const { date, viewMode, className } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "date query parameter (YYYY-MM-DD) is required.",
      });
    }

    const parsed = parseCalendarDate(date);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid date format. Expected YYYY-MM-DD.",
      });
    }

    const filter = {
      dateStr: parsed.dateStr,
    };

    if (viewMode === "class" && className) {
      filter.className = String(className).trim();
    }

    // Teacher authorization: Scope queries exclusively to assigned students
    const isTeacher = req.user.role === "teacher";
    if (isTeacher) {
      const assignedIds = Array.isArray(req.user.assignedStudentIds) ? req.user.assignedStudentIds : [];
      if (assignedIds.length === 0) {
        return res.status(200).json({
          success: true,
          date: parsed.dateStr,
          count: 0,
          records: [],
        });
      }
      filter.studentId = { $in: assignedIds };
    }

    const records = await Attendance.find(filter).sort({ className: 1, studentName: 1 });

    return res.status(200).json({
      success: true,
      date: parsed.dateStr,
      count: records.length,
      records,
    });
  } catch (err) {
    console.error("Attendance daily-details error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

/**
 * GET /api/attendance/classes
 * Returns distinct class names accessible to the user
 */
router.get("/classes", async (req, res) => {
  try {
    const isTeacher = req.user.role === "teacher";
    const filter = isTeacher
      ? { studentId: { $in: req.user.assignedStudentIds || [] } }
      : {};

    const classes = await Attendance.distinct("className", filter);
    return res.status(200).json({
      success: true,
      classes: Array.isArray(classes) ? classes.sort() : [],
    });
  } catch (err) {
    console.error("Attendance classes error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

/**
 * POST /api/attendance
 * Mark or bulk update attendance records.
 * Enforces strict authorization: Teachers may ONLY mark attendance for assigned students.
 * Bulk operations cannot bypass authorization: if any record is unassigned, entire batch is rejected.
 */
router.post("/", async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Array of attendance records is required.",
      });
    }

    if (records.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Batch size limit exceeded. Maximum 500 records per submission.",
      });
    }

    const isTeacher = req.user.role === "teacher";
    const teacherAssignedIds = isTeacher && Array.isArray(req.user.assignedStudentIds)
      ? new Set(req.user.assignedStudentIds)
      : new Set();

    const allowedStatuses = ["present", "absent", "late", "excused"];
    const bulkOps = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.studentId || !record.studentName || !record.className || !record.date) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Record at index ${i} is missing required fields (studentId, studentName, className, date).`,
        });
      }

      const cleanStudentId = String(record.studentId).trim();
      const status = record.status ? String(record.status).toLowerCase().trim() : "present";

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid attendance status '${record.status}' at index ${i}. Allowed: ${allowedStatuses.join(", ")}`,
        });
      }

      // Teacher authorization check on every single record in batch
      if (isTeacher && !teacherAssignedIds.has(cleanStudentId)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: `Forbidden: Teacher is not authorized to mark attendance for unassigned student '${cleanStudentId}'. Entire batch rejected.`,
        });
      }

      const parsed = parseCalendarDate(record.date);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid date format '${record.date}' at index ${i}. Expected YYYY-MM-DD or ISO date.`,
        });
      }

      const cleanClassName = String(record.className).trim();
      const cleanStudentName = String(record.studentName).trim();
      const cleanSchool = record.school ? String(record.school).trim() : "Main Campus";
      const remarks = record.remarks ? String(record.remarks).trim() : "";

      bulkOps.push({
        updateOne: {
          filter: {
            studentId: cleanStudentId,
            dateStr: parsed.dateStr,
            className: cleanClassName,
          },
          update: {
            $set: {
              studentId: cleanStudentId,
              studentName: cleanStudentName,
              className: cleanClassName,
              school: cleanSchool,
              date: parsed.date,
              dateStr: parsed.dateStr,
              status,
              remarks,
            },
          },
          upsert: true,
        },
      });
    }

    const result = await Attendance.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: "Attendance records saved successfully.",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (err) {
    console.error("Save attendance error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

module.exports = router;
