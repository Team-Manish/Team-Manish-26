const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: false,
    trim: true,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
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
});

module.exports = mongoose.model("Student", studentSchema);