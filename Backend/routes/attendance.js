const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { authorize } = require("../middleware/rbac");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

// Protect attendance endpoints exclusively for admin and teacher roles
router.use(authorize(["admin", "teacher"]));

// Priority 4: Rate Limiting on Attendance Mutations (POST /api/attendance)
const attendanceMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 write batches per 15 minutes per IP
  message: {
    success: false,
    error: "Too Many Requests",
    message: "Too many attendance write requests. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Priority 3: Strict Attendance Calendar-Date Contract
 * Accepts only explicit "YYYY-MM-DD" calendar date strings.
 * Validates real calendar bounds (including month lengths and leap years).
 * Operates on a UTC Calendar Day contract (00:00:00.000Z).
 * Rejects arbitrary timestamps, non-date strings, and invalid days (e.g. 2026-02-30).
 */
function parseStrictCalendarDate(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const regex = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const match = trimmed.match(regex);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Validate real days in month (handles February leap years)
  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > maxDays) return null;

  const dateStr = `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return { date, dateStr, year, month, day };
}

/**
 * GET /api/attendance/heatmap
 * Query params: year (YYYY), month (1-12), viewMode ("school" | "class"), className, school
 * Enforces teacher assigned-student filtering and case normalization.
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

    // Teacher authorization: Scope queries exclusively to assigned students with case normalization
    const isTeacher = req.user.role === "teacher";
    if (isTeacher) {
      const assignedIds = Array.isArray(req.user.assignedStudentIds)
        ? req.user.assignedStudentIds.map((id) => String(id).trim().toUpperCase())
        : [];

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

    // Execute aggregation in MongoDB
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
    const teacherAssignedIds = isTeacher && Array.isArray(req.user.assignedStudentIds)
      ? req.user.assignedStudentIds.map((id) => String(id).trim().toUpperCase())
      : [];
    const classQueryFilter = isTeacher
      ? { studentId: { $in: teacherAssignedIds } }
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
 * Enforces strict calendar date and role-scoped teacher filtering.
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

    const parsed = parseStrictCalendarDate(date);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid date format. Expected strict YYYY-MM-DD calendar date.",
      });
    }

    const filter = {
      dateStr: parsed.dateStr,
    };

    if (viewMode === "class" && className) {
      filter.className = String(className).trim();
    }

    // Teacher authorization: Scope queries exclusively to assigned students with case normalization
    const isTeacher = req.user.role === "teacher";
    if (isTeacher) {
      const assignedIds = Array.isArray(req.user.assignedStudentIds)
        ? req.user.assignedStudentIds.map((id) => String(id).trim().toUpperCase())
        : [];
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
 * Returns distinct class names accessible to the requesting user
 */
router.get("/classes", async (req, res) => {
  try {
    const isTeacher = req.user.role === "teacher";
    const assignedIds = isTeacher && Array.isArray(req.user.assignedStudentIds)
      ? req.user.assignedStudentIds.map((id) => String(id).trim().toUpperCase())
      : [];
    const filter = isTeacher ? { studentId: { $in: assignedIds } } : {};

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
 *
 * Priority 2: Validates student ID against trusted Student database records.
 *             Derives authoritative studentName from Student collection (never client-supplied name).
 * Priority 3: Strictly requires YYYY-MM-DD calendar dates.
 * Priority 4: Protected by attendanceMutationLimiter rate limiter.
 * Priority 5: Pre-validates all records before execution; reports explicit error on database failure.
 * Priority 6: Enforces case-insensitive identifier normalization (UPPERCASE).
 */
router.post("/", attendanceMutationLimiter, async (req, res) => {
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
    const teacherAssignedSet = new Set(
      isTeacher && Array.isArray(req.user.assignedStudentIds)
        ? req.user.assignedStudentIds.map((id) => String(id).trim().toUpperCase())
        : []
    );

    const allowedStatuses = ["present", "absent", "late", "excused"];
    const submittedStudentIds = [
      ...new Set(
        records
          .map((r) => (r && r.studentId ? String(r.studentId).trim().toUpperCase() : null))
          .filter(Boolean)
      ),
    ];

    // Priority 2: Query authoritative student records from MongoDB if connected
    const trustedStudentsMap = new Map();
    if (mongoose.connection.readyState === 1 && submittedStudentIds.length > 0) {
      const studentDocs = await Student.find({
        studentId: { $in: submittedStudentIds },
      });
      studentDocs.forEach((s) => {
        trustedStudentsMap.set(s.studentId.toUpperCase(), s);
      });
    }

    const bulkOps = [];

    // Pre-validation pass across the entire batch
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record || typeof record !== "object") {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Record at index ${i} is invalid. Expected an object.`,
        });
      }

      if (!record.studentId || !record.className || !record.date) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Record at index ${i} is missing required fields (studentId, className, date).`,
        });
      }

      const cleanStudentId = String(record.studentId).trim().toUpperCase();
      const status = record.status ? String(record.status).toLowerCase().trim() : "present";

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid attendance status '${record.status}' at index ${i}. Allowed: ${allowedStatuses.join(", ")}`,
        });
      }

      // Priority 3: Enforce strict YYYY-MM-DD calendar date contract
      const parsed = parseStrictCalendarDate(record.date);
      if (!parsed) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: `Invalid date '${record.date}' at index ${i}. Expected strict 'YYYY-MM-DD' calendar date.`,
        });
      }

      // Priority 2: Verify student exists in authoritative database registry (when DB active)
      let trustedStudent = null;
      if (mongoose.connection.readyState === 1) {
        trustedStudent = trustedStudentsMap.get(cleanStudentId);
        if (!trustedStudent) {
          return res.status(400).json({
            success: false,
            error: "Bad Request",
            message: `Student with ID '${cleanStudentId}' does not exist in authoritative student registry. Entire batch rejected.`,
          });
        }
      }

      // Teacher authorization check: Verify teacher is assigned to student
      if (isTeacher) {
        const isAssigned =
          teacherAssignedSet.has(cleanStudentId) ||
          (trustedStudent &&
            trustedStudent.assignedTeacherId &&
            trustedStudent.assignedTeacherId.trim().toUpperCase() ===
              (req.user.userId || "").trim().toUpperCase());

        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            error: "Forbidden",
            message: `Forbidden: Teacher is not authorized to mark attendance for unassigned student '${cleanStudentId}'. Entire batch rejected.`,
          });
        }
      }

      // Priority 2: Authoritative student name derivation
      const trustedName = trustedStudent
        ? trustedStudent.name
        : record.studentName
        ? String(record.studentName).trim()
        : "Student";

      const cleanClassName = String(record.className).trim();
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
              studentName: trustedName, // Authoritative derivation
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

    // Priority 5: Execute bulk write with ordered execution and transparent error reporting
    try {
      const result = await Attendance.bulkWrite(bulkOps, { ordered: true });
      return res.status(200).json({
        success: true,
        message: "Attendance records saved successfully.",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
      });
    } catch (dbErr) {
      console.error("Attendance bulkWrite database failure:", dbErr.message);
      return res.status(500).json({
        success: false,
        error: "Database Write Error",
        message:
          "Database error occurred during bulk attendance write. Prior records in this ordered batch may have been committed.",
        failedIndex: dbErr.index !== undefined ? dbErr.index : null,
        details: dbErr.message,
      });
    }
  } catch (err) {
    console.error("Save attendance unexpected error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

module.exports = router;
