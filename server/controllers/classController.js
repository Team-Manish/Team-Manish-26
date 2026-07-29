const Class = require('../models/Class');

const getClasses = async (req, res, next) => {
  try {
    const classes = await Class.find().populate('teacher', 'name email');
    res.status(200).json({
      success: true,
      data: classes,
    });
  } catch (error) {
    next(error);
  }
};

const getClassById = async (req, res, next) => {
  try {
    const classObj = await Class.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'firstName lastName rollNumber');

    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.status(200).json({
      success: true,
      data: classObj,
    });
  } catch (error) {
    next(error);
  }
};

const createClass = async (req, res, next) => {
  try {
    const { name, section, teacher, subjects } = req.body;

    const existingClass = await Class.findOne({ name, section });
    if (existingClass) {
      return res.status(409).json({ success: false, message: 'Class with this name and section already exists' });
    }

    const teacherId = teacher || req.user._id;
    const newClass = await Class.create({
      name,
      section: section || 'A',
      teacher: teacherId,
      subjects,
    });

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: newClass,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClasses,
  getClassById,
  createClass,
};
