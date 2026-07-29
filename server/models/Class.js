const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      unique: true,
    },
    section: {
      type: String,
      default: 'A',
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference is required'],
    },
    subjects: [{
      type: String,
      trim: true,
    }],
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

classSchema.index({ name: 1, section: 1 }, { unique: true });

classSchema.virtual('studentCount').get(function () {
  return this.students ? this.students.length : 0;
});

module.exports = mongoose.model('Class', classSchema);
