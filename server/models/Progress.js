const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
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
    subject: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: [100, 'Subject name cannot exceed 100 characters'],
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    maxScore: {
      type: Number,
      default: 100,
      min: [1, 'Max score must be at least 1'],
    },
    grade: {
      type: String,
      trim: true,
      maxlength: [10, 'Grade cannot exceed 10 characters'],
    },
    examType: {
      type: String,
      enum: {
        values: ['quiz', 'assignment', 'midterm', 'final', 'project', 'homework', 'other'],
        message: 'Exam type must be quiz, assignment, midterm, final, project, homework, or other',
      },
      required: [true, 'Exam type is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher who recorded progress is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

progressSchema.index({ student: 1, date: -1 });
progressSchema.index({ student: 1, subject: 1 });
progressSchema.index({ class: 1, subject: 1 });

progressSchema.virtual('percentage').get(function () {
  return this.maxScore ? Math.round((this.score / this.maxScore) * 100) : 0;
});

progressSchema.statics.getSubjectAverages = async function (studentId) {
  return this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: '$subject',
        avgScore: { $avg: '$score' },
        maxScore: { $first: '$maxScore' },
        totalExams: { $sum: 1 },
        latestDate: { $max: '$date' },
      },
    },
    { $sort: { latestDate: -1 } },
    {
      $project: {
        subject: '$_id',
        avgScore: { $round: ['$avgScore', 1] },
        maxScore: 1,
        percentage: { $round: [{ $multiply: [{ $divide: ['$avgScore', '$maxScore'] }, 100] }, 1] },
        totalExams: 1,
        latestDate: 1,
        _id: 0,
      },
    },
  ]);
};

progressSchema.statics.getGradeDistribution = async function (studentId) {
  return this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $addFields: {
        percentage: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
      },
    },
    {
      $bucket: {
        groupBy: '$percentage',
        boundaries: [0, 40, 60, 75, 90, 101],
        default: 'Other',
        output: {
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
        },
      },
    },
    {
      $project: {
        range: '$_id',
        count: 1,
        avgScore: { $round: ['$avgScore', 1] },
        _id: 0,
      },
    },
  ]);
};

module.exports = mongoose.model('Progress', progressSchema);
