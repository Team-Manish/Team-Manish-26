const Progress = require('../models/Progress');
const Class = require('../models/Class');
const Student = require('../models/Student');

const createProgress = async (req, res, next) => {
  try {
    const { studentId, classId, subject, score, maxScore, grade, examType, date, remarks } = req.body;

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const student = await Student.findOne({ _id: studentId, class: classId, isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in this class' });
    }

    const finalScore = maxScore ? Math.round((score / maxScore) * 100) : score;
    let computedGrade = grade;
    if (!computedGrade) {
      if (finalScore >= 90) computedGrade = 'A+';
      else if (finalScore >= 80) computedGrade = 'A';
      else if (finalScore >= 70) computedGrade = 'B+';
      else if (finalScore >= 60) computedGrade = 'B';
      else if (finalScore >= 50) computedGrade = 'C';
      else if (finalScore >= 40) computedGrade = 'D';
      else computedGrade = 'F';
    }

    const progress = await Progress.create({
      student: studentId,
      class: classId,
      subject,
      score,
      maxScore: maxScore || 100,
      grade: computedGrade,
      examType,
      date: date || new Date(),
      remarks: remarks || '',
      recordedBy: req.user._id,
    });

    await progress.populate([
      { path: 'student', select: 'firstName lastName rollNumber' },
      { path: 'recordedBy', select: 'name' },
    ]);

    res.status(201).json({ success: true, message: 'Progress recorded successfully', data: progress });
  } catch (error) {
    next(error);
  }
};

const getProgressByStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { subject, examType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const filter = { student: studentId };
    if (subject) filter.subject = subject;
    if (examType) filter.examType = examType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Progress.countDocuments(filter);
    const progress = await Progress.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('recordedBy', 'name');

    const [subjectAverages, gradeDistribution] = await Promise.all([
      Progress.getSubjectAverages(studentId),
      Progress.getGradeDistribution(studentId),
    ]);

    const overallAvg = subjectAverages.length
      ? Math.round(subjectAverages.reduce((acc, s) => acc + s.percentage, 0) / subjectAverages.length)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        student: { id: student._id, firstName: student.firstName, lastName: student.lastName, rollNumber: student.rollNumber },
        records: progress,
        analytics: {
          subjectAverages,
          gradeDistribution,
          overallPercentage: overallAvg,
          totalRecords: total,
        },
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getParentChildProgress = async (req, res, next) => {
  try {
    const student = await Student.findOne({ parent: req.user._id, isActive: true });
    if (!student) {
      return res.status(404).json({ success: false, message: 'No child record linked to your account' });
    }

    const { subject, examType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { student: student._id };
    if (subject) filter.subject = subject;
    if (examType) filter.examType = examType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await Progress.countDocuments(filter);
    const records = await Progress.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('recordedBy', 'name');

    const [subjectAverages, gradeDistribution] = await Promise.all([
      Progress.getSubjectAverages(student._id),
      Progress.getGradeDistribution(student._id),
    ]);

    const overallAvg = subjectAverages.length
      ? Math.round(subjectAverages.reduce((acc, s) => acc + s.percentage, 0) / subjectAverages.length)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        student: { id: student._id, firstName: student.firstName, lastName: student.lastName, rollNumber: student.rollNumber },
        records,
        analytics: {
          subjectAverages,
          gradeDistribution,
          overallPercentage: overallAvg,
          totalRecords: total,
        },
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const progress = await Progress.findById(id);
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress record not found' });
    }

    if (progress.recordedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this record' });
    }

    if (updates.score !== undefined) {
      updates.grade = updates.grade || (() => {
        const maxScore = updates.maxScore || progress.maxScore || 100;
        const pct = Math.round((updates.score / maxScore) * 100);
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B+';
        if (pct >= 60) return 'B';
        if (pct >= 50) return 'C';
        if (pct >= 40) return 'D';
        return 'F';
      })();
    }

    const updated = await Progress.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('student', 'firstName lastName rollNumber')
      .populate('recordedBy', 'name');

    res.status(200).json({ success: true, message: 'Progress updated', data: updated });
  } catch (error) {
    next(error);
  }
};

const getClassComparison = async (req, res, next) => {
  try {
    const { subject, startDate, endDate } = req.query;

    const matchStage = {};
    if (subject && subject !== 'all') {
      matchStage.subject = subject;
    }
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { classId: '$class', subject: '$subject' },
          avgScore: { $avg: '$score' },
          maxScore: { $first: '$maxScore' },
          totalRecords: { $sum: 1 },
          studentCount: { $addToSet: '$student' },
        },
      },
      {
        $project: {
          classId: '$_id.classId',
          subject: '$_id.subject',
          avgScore: { $round: ['$avgScore', 1] },
          maxScore: 1,
          totalRecords: 1,
          studentCount: { $size: '$studentCount' },
          percentage: {
            $round: [{ $multiply: [{ $divide: ['$avgScore', '$maxScore'] }, 100] }, 1],
          },
          _id: 0,
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'classInfo',
        },
      },
      { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$classId',
          className: { $first: '$classInfo.name' },
          section: { $first: '$classInfo.section' },
          overallAvg: { $avg: '$avgScore' },
          overallPercentage: { $avg: '$percentage' },
          totalRecords: { $sum: '$totalRecords' },
          totalStudents: { $max: '$studentCount' },
          subjects: {
            $push: {
              subject: '$subject',
              avgScore: '$avgScore',
              percentage: '$percentage',
              totalRecords: '$totalRecords',
            },
          },
        },
      },
      {
        $project: {
          classId: '$_id',
          className: 1,
          section: 1,
          overallAvg: { $round: ['$overallAvg', 1] },
          overallPercentage: { $round: ['$overallPercentage', 1] },
          totalRecords: 1,
          totalStudents: 1,
          subjects: 1,
          _id: 0,
        },
      },
      { $sort: { overallPercentage: -1 } },
    ];

    const classData = await Progress.aggregate(pipeline);

    let subjectsList = await Progress.distinct('subject', matchStage);
    subjectsList = subjectsList.sort();

    res.status(200).json({
      success: true,
      data: {
        classes: classData,
        subjects: subjectsList,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteProgress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const progress = await Progress.findById(id);
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress record not found' });
    }

    if (progress.recordedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this record' });
    }

    await Progress.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Progress record deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProgress,
  getProgressByStudent,
  getParentChildProgress,
  updateProgress,
  deleteProgress,
  getClassComparison,
};
