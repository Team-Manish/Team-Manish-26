const mongoose = require("mongoose");

const VALID_COMPLETION_STATUSES = ["not_started", "in_progress", "completed", "blocked"];

const userProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          return typeof v === "string" && v.trim().length > 0;
        },
        message: "userId must be a non-empty string",
      },
    },

    contentId: {
      type: String,
      required: [true, "contentId is required"],
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          return typeof v === "string" && v.trim().length > 0;
        },
        message: "contentId must be a non-empty string",
      },
    },

    progressPercentage: {
      type: Number,
      required: [true, "progressPercentage is required"],
      min: [0, "progressPercentage cannot be less than 0"],
      max: [100, "progressPercentage cannot be greater than 100"],
      validate: {
        validator: function (v) {
          return typeof v === "number" && !isNaN(v) && v >= 0 && v <= 100;
        },
        message: (props) => `Invalid progressPercentage '${props.value}'. Must be a number between 0 and 100.`,
      },
    },

    completionStatus: {
      type: String,
      required: [true, "completionStatus is required"],
      trim: true,
      enum: {
        values: VALID_COMPLETION_STATUSES,
        message: `Invalid completionStatus '{VALUE}'. Allowed values are: ${VALID_COMPLETION_STATUSES.join(", ")}.`,
      },
    },

    timestamp: {
      type: Date,
      default: Date.now,
      validate: {
        validator: function (v) {
          if (!v) return false;
          const d = new Date(v);
          return !isNaN(d.getTime());
        },
        message: "timestamp must be a valid date",
      },
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on userId and contentId to prevent duplicate progress entries
userProgressSchema.index({ userId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model("UserProgress", userProgressSchema);
