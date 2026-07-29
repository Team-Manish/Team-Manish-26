const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Student = require('../models/Student');

const normalizeToStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const markAttendance = async (req, res, next) => {
  try {
    const { classId, date, records } = req.body;

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    const studentIds = records.map((r) => r.studentId);
    const uniqueIds = [...new Set(studentIds)];

    if (uniqueIds.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate student IDs found in attendance records',
      });
    }

    const students = await Student.find({
      _id: { $in: studentIds },
      class: classId,
      isActive: true,
    }).select('_id');

    const validStudentIds = new Set(students.map((s) => s._id.toString()));
    const invalidIds = studentIds.filter((id) => !validStudentIds.has(id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Students not found or inactive in this class: ${invalidIds.join(', ')}`,
      });
    }

    const attendanceDate = normalizeToStartOfDay(date);

    const bulkOps = records.map((record) => ({
      updateOne: {
        filter: {
          student: record.studentId,
          class: classId,
          date: attendanceDate,
        },
        update: {
          $set: {
            student: record.studentId,
            class: classId,
            date: attendanceDate,
            status: record.status,
            markedBy: req.user._id,
            remarks: record.remarks || '',
          },
        },
        upsert: true,
      },
    }));

    const result = await Attendance.bulkWrite(bulkOps);

    const updatedAttendance = await Attendance.find({
      class: classId,
      date: attendanceDate,
    })
      .populate('student', 'firstName lastName rollNumber')
      .populate('markedBy', 'name');

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused').length,
    };

    res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully',
      data: {
        attendance: updatedAttendance,
        summary,
        upsertedCount: result.upsertedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAttendanceByClassAndDate = async (req, res, next) => {
  try {
    const { classId, date } = req.query;

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    const attendanceDate = normalizeToStartOfDay(date);
    const endOfDay = new Date(attendanceDate);
    endOfDay.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      class: classId,
      date: { $gte: attendanceDate, $lte: endOfDay },
    })
      .populate('student', 'firstName lastName rollNumber')
      .populate('markedBy', 'name');

    const totalStudents = await Student.countDocuments({
      class: classId,
      isActive: true,
    });

    const markedCount = attendance.length;

    const summary = {
      totalStudents,
      markedCount,
      unmarkedCount: totalStudents - markedCount,
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      excused: attendance.filter((a) => a.status === 'excused').length,
    };

    res.status(200).json({
      success: true,
      data: {
        class: {
          id: classExists._id,
          name: classExists.name,
          section: classExists.section,
        },
        date: attendanceDate,
        attendance,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAttendanceSummary = async (req, res, next) => {
  try {
    const { classId, startDate, endDate } = req.query;

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    const summary = await Attendance.getAttendanceSummary(classId, startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        class: {
          id: classExists._id,
          name: classExists.name,
          section: classExists.section,
        },
        dateRange: { startDate, endDate },
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await Attendance.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    if (record.markedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this attendance record',
      });
    }

    await Attendance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

const deleteAttendanceByClassAndDate = async (req, res, next) => {
  try {
    const { classId, date } = req.query;

    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    const attendanceDate = normalizeToStartOfDay(date);

    const result = await Attendance.deleteMany({
      class: classId,
      date: attendanceDate,
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} attendance record(s) for the specified class and date`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error) {
    next(error);
  }
};

const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    if (req.user.role === 'parent') {
      const student = await Student.findById(studentId).select('parent');
      if (!student || student.parent?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this student\'s attendance',
        });
      }
    }

    const student = await Student.findById(studentId)
      .select('firstName lastName rollNumber class')
      .populate('class', 'name section');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const attendance = await Attendance.getStudentAttendanceHistory(
      studentId,
      startDate,
      endDate,
    );

    const totalRecords = attendance.length;
    const summary = {
      total: totalRecords,
      present: attendance.filter((a) => a.status === 'present').length,
      absent: attendance.filter((a) => a.status === 'absent').length,
      late: attendance.filter((a) => a.status === 'late').length,
      excused: attendance.filter((a) => a.status === 'excused').length,
      attendanceRate:
        totalRecords > 0
          ? Math.round(
              (attendance.filter((a) => a.status === 'present').length / totalRecords) * 100,
            )
          : 0,
    };

    const monthlySummary = await Attendance.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          ...(startDate || endDate ? {
            date: {
              ...(startDate ? { $gte: normalizeToStartOfDay(startDate) } : {}),
              ...(endDate ? { $lte: normalizeToStartOfDay(endDate) } : {}),
            }
          } : {}),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { year: '$_id.year', month: '$_id.month' },
          totalDays: { $sum: '$count' },
          records: {
            $push: { status: '$_id.status', count: '$count' },
          },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1,
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: 1,
          totalDays: 1,
          records: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        student,
        attendance,
        summary: monthlySummary.length ? monthlySummary : [],
        stats: summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getAttendanceByClassAndDate,
  getAttendanceSummary,
  getStudentAttendance,
  deleteAttendance,
  deleteAttendanceByClassAndDate,
};
