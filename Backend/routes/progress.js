const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const UserProgress = require("../models/UserProgress");
const AcademicProgress = require("../models/AcademicProgress");
const Student = require("../models/Student");
const User = require("../models/User");

const VALID_COMPLETION_STATUSES = ["not_started", "in_progress", "completed", "blocked"];
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

// In-memory cache for fast sub-200ms lookup of progress records (TTL: 60s)
const progressCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedProgress(key) {
  const cached = progressCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    progressCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedProgress(key, data) {
  progressCache.set(key, { timestamp: Date.now(), data });
}

function invalidateCacheKey(studentId, subject) {
  if (!studentId || !subject) return;
  const key = `${studentId.trim().toLowerCase()}:${subject.trim().toLowerCase()}`;
  progressCache.delete(key);
}

/**
 * Helper to title case strings (e.g. "computer science" -> "Computer Science")
 */
function toTitleCase(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Helper to extract and verify user from Bearer header or cookie
 */
function extractUserFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies["auth-token"]) {
    token = req.cookies["auth-token"];
  }

  if (!token) return req.user || null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * GET /api/progress & GET /api/v1/progress
 * Retrieve student learning progress by studentId and subject query parameters.
 */
router.get("/", async (req, res) => {
  try {
    const { studentId, subject } = req.query;

    // 1. Query parameter validation: studentId & subject are required
    if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Missing or malformed required query parameter 'studentId'. Must be a non-empty string.",
      });
    }

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Missing or malformed required query parameter 'subject'. Must be a non-empty string.",
      });
    }

    const trimmedStudentId = studentId.trim();
    const normalizedSubject = toTitleCase(subject);

    // Validate studentId format (3-30 alphanumeric, hyphen, underscore)
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(trimmedStudentId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Invalid 'studentId' format '${trimmedStudentId}'. Must be 3-30 alphanumeric characters, hyphens, or underscores.`,
      });
    }

    // 2. Authorization / Security Controls
    const user = extractUserFromRequest(req);
    if (user) {
      const userRole = user.role || "student";
      const isTeacherOrAdmin = ["teacher", "admin", "moderator"].includes(userRole);
      const isOwnStudent =
        (user.studentId && user.studentId === trimmedStudentId) ||
        (user.email && user.email.toLowerCase() === trimmedStudentId.toLowerCase());

      if (!isTeacherOrAdmin && !isOwnStudent) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: `Access denied. Client with role '${userRole}' is not authorized to view progress for studentId '${trimmedStudentId}'.`,
        });
      }
    }

    // 3. Performance Cache Lookup (Sub-200ms target)
    const cacheKey = `${trimmedStudentId.toLowerCase()}:${normalizedSubject.toLowerCase()}`;
    const cachedRecord = getCachedProgress(cacheKey);
    if (cachedRecord) {
      return res.status(200).json({
        success: true,
        message: "Student progress record retrieved successfully (cached).",
        cached: true,
        data: cachedRecord,
      });
    }

    // 4. Student Existence Validation
    const studentDoc = await Student.findOne({
      $or: [{ studentId: trimmedStudentId }, { email: trimmedStudentId.toLowerCase() }],
    });

    const hasProgressRecord = await AcademicProgress.exists({
      studentId: trimmedStudentId,
    });

    if (!studentDoc && !hasProgressRecord) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Student record not found for studentId '${trimmedStudentId}'.`,
      });
    }

    if (studentDoc && studentDoc.enrolledSubjects && studentDoc.enrolledSubjects.length > 0) {
      const isEnrolled = studentDoc.enrolledSubjects.some(
        (s) => s.toLowerCase() === normalizedSubject.toLowerCase()
      );
      if (!isEnrolled) {
        return res.status(404).json({
          success: false,
          error: "Not Found",
          message: `Student '${trimmedStudentId}' is not enrolled in subject '${normalizedSubject}'.`,
        });
      }
    }

    // 5. Database Query for Progress Data
    const progressDoc = await AcademicProgress.findOne({
      studentId: trimmedStudentId,
      subject: normalizedSubject,
    });

    if (!progressDoc) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `No progress record found for studentId '${trimmedStudentId}' and subject '${normalizedSubject}'.`,
      });
    }

    const responsePayload = {
      id: progressDoc._id.toString(),
      studentId: progressDoc.studentId,
      subject: progressDoc.subject,
      grade: progressDoc.grade,
      overallCompletionPercentage:
        progressDoc.overallCompletionPercentage !== undefined
          ? progressDoc.overallCompletionPercentage
          : typeof progressDoc.grade === "number"
          ? progressDoc.grade
          : 100,
      topics: progressDoc.topics || [],
      cumulativeTimeSpentMinutes: progressDoc.cumulativeTimeSpentMinutes || 0,
      latestActivityTimestamp:
        progressDoc.latestActivityTimestamp || progressDoc.updatedAt || progressDoc.date,
      remarks: progressDoc.remarks || "",
      date: progressDoc.date,
      createdAt: progressDoc.createdAt,
      updatedAt: progressDoc.updatedAt,
    };

    setCachedProgress(cacheKey, responsePayload);

    return res.status(200).json({
      success: true,
      message: "Student progress record retrieved successfully.",
      cached: false,
      data: responsePayload,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: `Failed to retrieve student progress record: ${err.message}`,
    });
  }
});

/**
 * GET /api/progress/student/:studentId & GET /api/v1/progress/student/:studentId
 * Retrieve all academic progress records for a selected student over time and across subjects.
 */
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject } = req.query;

    if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Missing or malformed required URL parameter 'studentId'. Must be a non-empty string.",
      });
    }

    const trimmedStudentId = studentId.trim();

    // Validate studentId format (3-30 alphanumeric, hyphen, underscore)
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(trimmedStudentId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Invalid 'studentId' format '${trimmedStudentId}'. Must be 3-30 alphanumeric characters, hyphens, or underscores.`,
      });
    }

    // Authorization / Security Controls
    const user = extractUserFromRequest(req);
    if (user) {
      const userRole = user.role || "student";
      const isTeacherOrAdmin = ["teacher", "admin", "moderator"].includes(userRole);
      const isOwnStudent =
        (user.studentId && user.studentId === trimmedStudentId) ||
        (user.email && user.email.toLowerCase() === trimmedStudentId.toLowerCase());

      if (!isTeacherOrAdmin && !isOwnStudent) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: `Access denied. Client with role '${userRole}' is not authorized to view progress for studentId '${trimmedStudentId}'.`,
        });
      }
    }

    // Query database for academic progress entries
    const query = {
      $or: [
        { studentId: trimmedStudentId },
        { studentId: trimmedStudentId.toUpperCase() },
        { studentId: trimmedStudentId.toLowerCase() }
      ]
    };

    if (subject && typeof subject === "string" && subject.trim()) {
      query.subject = toTitleCase(subject);
    }

    let records = await AcademicProgress.find(query).sort({ date: 1, createdAt: 1 });

    const formattedRecords = records.map((doc) => ({
      id: doc._id ? doc._id.toString() : doc.id,
      studentId: doc.studentId,
      subject: doc.subject,
      grade: doc.grade,
      score:
        typeof doc.grade === "number"
          ? doc.grade
          : !isNaN(parseFloat(doc.grade))
          ? parseFloat(doc.grade)
          : doc.overallCompletionPercentage || 85,
      overallCompletionPercentage:
        doc.overallCompletionPercentage !== undefined ? doc.overallCompletionPercentage : 85,
      cumulativeTimeSpentMinutes: doc.cumulativeTimeSpentMinutes || 0,
      topics: doc.topics || [],
      remarks: doc.remarks || "",
      date: doc.date || doc.createdAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: formattedRecords.length,
      studentId: trimmedStudentId,
      data: formattedRecords,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: `Failed to retrieve student progress history: ${err.message}`,
    });
  }
});


/**
 * Validates payload fields for POST/PUT progress requests.
 */
function validateProgressPayload(data, isUpdate = false) {
  const { userId, contentId, progressPercentage, completionStatus, timestamp } = data;

  if (!isUpdate || userId !== undefined) {
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return "Invalid or missing 'userId'. Must be a non-empty string.";
    }
  }

  if (!isUpdate || contentId !== undefined) {
    if (!contentId || typeof contentId !== "string" || !contentId.trim()) {
      return "Invalid or missing 'contentId'. Must be a non-empty string.";
    }
  }

  if (!isUpdate || progressPercentage !== undefined) {
    if (
      progressPercentage === undefined ||
      typeof progressPercentage !== "number" ||
      isNaN(progressPercentage) ||
      progressPercentage < 0 ||
      progressPercentage > 100
    ) {
      return "Invalid or missing 'progressPercentage'. Must be a number between 0 and 100.";
    }
  }

  if (!isUpdate || completionStatus !== undefined) {
    if (
      !completionStatus ||
      typeof completionStatus !== "string" ||
      !VALID_COMPLETION_STATUSES.includes(completionStatus.trim())
    ) {
      return `Invalid or missing 'completionStatus'. Allowed values: ${VALID_COMPLETION_STATUSES.join(
        ", "
      )}.`;
    }
  }

  if (timestamp !== undefined && timestamp !== null) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return "Invalid 'timestamp'. Must be a valid date or ISO 8601 string.";
    }
  }

  return null;
}

/**
 * POST /api/progress
 */
router.post("/", async (req, res) => {
  try {
    const validationError = validateProgressPayload(req.body, false);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: validationError,
      });
    }

    const { userId, contentId, progressPercentage, completionStatus, timestamp, message, metadata } =
      req.body;

    const progressRecord = new UserProgress({
      userId: userId.trim(),
      contentId: contentId.trim(),
      progressPercentage,
      completionStatus: completionStatus.trim(),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      message: message ? String(message).trim() : "",
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });

    const savedRecord = await progressRecord.save();
    invalidateCacheKey(userId, contentId);

    return res.status(201).json({
      success: true,
      message: "Progress record created successfully.",
      data: savedRecord,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: `Progress record already exists for userId '${req.body.userId}' and contentId '${req.body.contentId}'. Use PUT to update existing record.`,
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: `Database write failure: ${err.message}`,
    });
  }
});

/**
 * PUT /api/progress/:userId/:contentId & PUT /api/progress
 */
const handlePutProgress = async (req, res) => {
  try {
    const targetUserId = (req.params.userId || req.body.userId || "").trim();
    const targetContentId = (req.params.contentId || req.body.contentId || "").trim();

    if (!targetUserId || !targetContentId) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Missing target identification: Both 'userId' and 'contentId' are required.",
      });
    }

    const validationError = validateProgressPayload(req.body, true);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: validationError,
      });
    }

    const updateFields = {};
    const { progressPercentage, completionStatus, timestamp, message, metadata } = req.body;

    if (progressPercentage !== undefined) updateFields.progressPercentage = progressPercentage;
    if (completionStatus !== undefined) updateFields.completionStatus = completionStatus.trim();
    if (timestamp !== undefined) updateFields.timestamp = new Date(timestamp);
    if (message !== undefined) updateFields.message = String(message).trim();
    if (metadata !== undefined) updateFields.metadata = metadata;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "No valid fields provided for update.",
      });
    }

    const updatedRecord = await UserProgress.findOneAndUpdate(
      { userId: targetUserId, contentId: targetContentId },
      { $set: updateFields },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Progress record not found for userId '${targetUserId}' and contentId '${targetContentId}'.`,
      });
    }

    invalidateCacheKey(targetUserId, targetContentId);

    return res.status(200).json({
      success: true,
      message: "Progress record updated successfully.",
      data: updatedRecord,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: `Database update failure: ${err.message}`,
    });
  }
};

router.put("/:userId/:contentId", handlePutProgress);
router.put("/", handlePutProgress);

module.exports = router;
