const mongoose = require("mongoose");

// List of standard institutional letter grades
const ALLOWED_LETTER_GRADES = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
  "P", "NP",
  "PASS", "FAIL",
  "INC",
];

/**
 * Helper function to convert a string to Title Case.
 * Example: "computer science" -> "Computer Science"
 */
function toTitleCase(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const academicProgressSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "studentId is required"],
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          if (typeof v !== "string") return false;
          const trimmed = v.trim();
          if (trimmed.length === 0) return false;
          // Must match valid student ID format: 3-30 alphanumeric characters, hyphens, or underscores
          return /^[A-Za-z0-9_-]{3,30}$/.test(trimmed);
        },
        message: (props) =>
          `Invalid studentId format '${props.value}'. Student ID must be non-empty and contain 3-30 alphanumeric characters, hyphens, or underscores (e.g. STU-1001).`,
      },
    },

    subject: {
      type: String,
      required: [true, "subject is required"],
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          if (typeof v !== "string") return false;
          const trimmed = v.trim();
          if (trimmed.length < 2 || trimmed.length > 100) return false;
          // Must be a valid academic subject name (letters, numbers, spaces, hyphens, ampersands, dots, parentheses)
          return /^[A-Za-z0-9\s&\-\.()]{2,100}$/.test(trimmed);
        },
        message: (props) =>
          `Invalid subject '${props.value}'. Subject must be between 2 and 100 characters and contain valid subject name characters.`,
      },
    },

    grade: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "grade is required"],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return false;

          // Numeric grade validation (number type)
          if (typeof v === "number") {
            return !isNaN(v) && v >= 0 && v <= 100;
          }

          // String grade validation (numeric string or letter grade)
          if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed === "") return false;

            // Check if string represents a valid number in range [0, 100]
            if (!isNaN(trimmed) && !isNaN(parseFloat(trimmed))) {
              const num = parseFloat(trimmed);
              return num >= 0 && num <= 100;
            }

            // Check if string matches allowed institutional letter grades
            const upper = trimmed.toUpperCase();
            return ALLOWED_LETTER_GRADES.includes(upper);
          }

          return false;
        },
        message: (props) =>
          `Invalid grade '${props.value}'. Grade must be a numeric score between 0 and 100 or a valid letter grade (${ALLOWED_LETTER_GRADES.join(
            ", "
          )}).`,
      },
    },

    remarks: {
      type: String,
      required: false,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },

    date: {
      type: Date,
      required: [true, "date is required"],
      default: Date.now,
      validate: {
        validator: function (v) {
          if (!v) return false;
          const d = new Date(v);
          if (isNaN(d.getTime())) return false;
          // Valid academic calendar date range check (1970 - 2100)
          const year = d.getFullYear();
          return year >= 1970 && year <= 2100;
        },
        message: (props) =>
          `Invalid date '${props.value}'. Date must be a valid academic calendar date between 1970 and 2100.`,
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Compound index on studentId and subject to prevent duplicate progress entries for the same student and subject
academicProgressSchema.index({ studentId: 1, subject: 1 }, { unique: true });

// Pre-validate middleware: normalize subject to Title Case and letter grades to uppercase
academicProgressSchema.pre("validate", function () {
  if (this.studentId && typeof this.studentId === "string") {
    this.studentId = this.studentId.trim();
  }

  if (this.subject && typeof this.subject === "string") {
    this.subject = toTitleCase(this.subject);
  }

  if (typeof this.grade === "string" && isNaN(this.grade)) {
    const trimmedGrade = this.grade.trim().toUpperCase();
    if (ALLOWED_LETTER_GRADES.includes(trimmedGrade)) {
      this.grade = trimmedGrade;
    }
  }

  if (this.remarks && typeof this.remarks === "string") {
    this.remarks = this.remarks.trim();
  }
});

module.exports = mongoose.model("AcademicProgress", academicProgressSchema);
