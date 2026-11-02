const mongoose = require("mongoose");

const VALID_ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"];

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "studentId is required"],
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: [true, "studentName is required"],
      trim: true,
    },
    className: {
      type: String,
      required: [true, "className is required"],
      trim: true,
      index: true,
    },
    school: {
      type: String,
      default: "Main Campus",
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: [true, "date is required"],
      index: true,
    },
    dateStr: {
      type: String,
      required: [true, "dateStr is required"],
      trim: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "dateStr must be in YYYY-MM-DD format"],
    },
    status: {
      type: String,
      required: [true, "status is required"],
      enum: {
        values: VALID_ATTENDANCE_STATUSES,
        message: `Invalid attendance status '{VALUE}'. Allowed values: ${VALID_ATTENDANCE_STATUSES.join(", ")}`,
      },
      default: "present",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to ensure date and dateStr are consistent UTC calendar representations
attendanceSchema.pre("validate", function () {
  if (this.date && !this.dateStr) {
    const d = new Date(this.date);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      this.dateStr = `${year}-${month}-${day}`;
    }
  }
  if (this.dateStr && !this.date) {
    const parts = this.dateStr.split("-").map(Number);
    if (parts.length === 3) {
      this.date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
    }
  }
});

// Compound unique index ensuring at most one record per student per date per class
attendanceSchema.index({ studentId: 1, dateStr: 1, className: 1 }, { unique: true });

// Performance indexes for class-level and school-level aggregations
attendanceSchema.index({ dateStr: 1, className: 1 });
attendanceSchema.index({ dateStr: 1, school: 1 });
attendanceSchema.index({ date: 1, className: 1 });
attendanceSchema.index({ date: 1, school: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
