const Student = require('../models/Student');
const Class = require('../models/Class');

const getStudents = async (req, res, next) => {
  try {
    const students = await Student.find({ isActive: true })
      .populate('class', 'name section')
      .populate('parent', 'name email');
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

const getStudentsByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const students = await Student.find({ class: classId, isActive: true })
      .sort({ rollNumber: 1 })
      .populate('class', 'name section');

    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('class', 'name section')
      .populate('parent', 'name email');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

const createStudent = async (req, res, next) => {
  try {
    const { firstName, lastName, rollNumber, class: classId, parent, dateOfBirth, gender, subjects } = req.body;

    const existingRoll = await Student.findOne({ rollNumber });
    if (existingRoll) {
      return res.status(409).json({ success: false, message: 'Student with this roll number already exists' });
    }

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const student = await Student.create({
      firstName,
      lastName,
      rollNumber,
      class: classId,
      parent,
      dateOfBirth,
      gender,
      subjects,
    });

    await Class.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });

    res.status(201).json({ success: true, message: 'Student created successfully', data: student });
  } catch (error) {
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (updates.class && updates.class.toString() !== student.class.toString()) {
      await Class.findByIdAndUpdate(student.class, { $pull: { students: id } });
      await Class.findByIdAndUpdate(updates.class, { $addToSet: { students: id } });
    }

    const updated = await Student.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('class', 'name section')
      .populate('parent', 'name email');

    res.status(200).json({ success: true, message: 'Student updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Class.findByIdAndUpdate(student.class, { $pull: { students: id } });
    await Student.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  getStudentsByClass,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
