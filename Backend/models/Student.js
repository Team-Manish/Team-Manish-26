const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },

  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  age: {
    type: Number,
    required: true,
  },

  enrolledSubjects: {
    type: [String],
    default: [],
  },

  assignedTeacherId: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Student", studentSchema);