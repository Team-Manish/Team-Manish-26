const express = require("express");
const router = express.Router();
const UserProgress = require("../models/UserProgress");

const VALID_COMPLETION_STATUSES = ["not_started", "in_progress", "completed", "blocked"];

/**
 * Validates payload fields for POST/PUT progress requests.
 * Returns an error message string if invalid, or null if valid.
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
 * Create a new user progress record in MongoDB.
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
 * PUT /api/progress/:userId/:contentId
 * PUT /api/progress
 * Update an existing user progress record in MongoDB by userId and contentId.
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
