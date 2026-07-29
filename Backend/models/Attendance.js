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

// Compound index for fast queries by date & class or date & school
attendanceSchema.index({ date: 1, className: 1 });
attendanceSchema.index({ date: 1, school: 1 });
attendanceSchema.index({ studentId: 1, date: 1, className: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
