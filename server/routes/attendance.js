const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getAttendanceByClassAndDate,
  getAttendanceSummary,
  getStudentAttendance,
  deleteAttendance,
  deleteAttendanceByClassAndDate,
} = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateBulkAttendance,
  validateGetAttendance,
  validateDateRange,
  validateStudentAttendance,
  validateDeleteAttendance,
} = require('../middleware/validators');

router.use(authenticate);

router.post('/', authorize('teacher', 'admin'), validateBulkAttendance, markAttendance);
router.get('/', authorize('teacher', 'admin', 'parent'), validateGetAttendance, getAttendanceByClassAndDate);
router.get('/summary', authorize('teacher', 'admin'), validateDateRange, getAttendanceSummary);
router.get('/student/:studentId', authorize('teacher', 'admin', 'parent'), validateStudentAttendance, getStudentAttendance);
router.delete('/:id', authorize('teacher', 'admin'), deleteAttendance);
router.delete('/', authorize('admin'), validateDeleteAttendance, deleteAttendanceByClassAndDate);

module.exports = router;
