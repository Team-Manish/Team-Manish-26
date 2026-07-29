const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentsByClass,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getStudents);
router.get('/class/:classId', getStudentsByClass);
router.get('/:id', getStudentById);
router.post('/', authorize('admin', 'teacher'), createStudent);
router.put('/:id', authorize('admin', 'teacher'), updateStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

module.exports = router;
