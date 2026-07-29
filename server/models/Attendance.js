const mongoose = require('mongoose');

const normalizeToStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class reference is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['present', 'absent', 'late', 'excused'],
        message: 'Status must be present, absent, late, or excused',
      },
      required: [true, 'Attendance status is required'],
      default: 'absent',
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher who marked attendance is required'],
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [200, 'Remarks cannot exceed 200 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

attendanceSchema.pre('save', function (next) {
  if (this.isModified('date')) {
    this.date = normalizeToStartOfDay(this.date);
  }
  next();
});

attendanceSchema.index({ class: 1, date: 1 });
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ student: 1, class: 1, date: 1 }, { unique: true });

attendanceSchema.statics.getAttendanceSummary = async function (classId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        class: new mongoose.Types.ObjectId(classId),
        date: {
          $gte: normalizeToStartOfDay(startDate),
          $lte: normalizeToStartOfDay(endDate),
        },
      },
    },
    {
      $group: {
        _id: { student: '$student', status: '$status' },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.student',
        records: {
          $push: { status: '$_id.status', count: '$count' },
        },
        totalDays: { $sum: '$count' },
        presentDays: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'studentInfo',
      },
    },
    { $unwind: '$studentInfo' },
    {
      $project: {
        studentId: '$_id',
        firstName: '$studentInfo.firstName',
        lastName: '$studentInfo.lastName',
        rollNumber: '$studentInfo.rollNumber',
        totalDays: 1,
        presentDays: 1,
        attendancePercentage: {
          $cond: [
            { $eq: ['$totalDays', 0] },
            0,
            { $round: [{ $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] }, 1] },
          ],
        },
        records: 1,
        _id: 0,
      },
    },
  ]);
};

attendanceSchema.statics.getDailyAttendance = async function (classId, date) {
  return this.find({
    class: classId,
    date: normalizeToStartOfDay(date),
  }).populate('student', 'firstName lastName rollNumber');
};

attendanceSchema.statics.getStudentAttendanceHistory = async function (studentId, startDate, endDate) {
  const query = { student: new mongoose.Types.ObjectId(studentId) };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = normalizeToStartOfDay(startDate);
    if (endDate) query.date.$lte = normalizeToStartOfDay(endDate);
  }

  return this.find(query)
    .populate('class', 'name section')
    .sort({ date: -1 });
};

module.exports = mongoose.model('Attendance', attendanceSchema);
