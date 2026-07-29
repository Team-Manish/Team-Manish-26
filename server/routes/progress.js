const express = require('express');
const router = express.Router();
const {
  createProgress,
  getProgressByStudent,
  getParentChildProgress,
  updateProgress,
  deleteProgress,
  getClassComparison,
} = require('../controllers/progressController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/class-comparison', authorize('admin'), getClassComparison);
router.get('/my-child', authorize('parent'), getParentChildProgress);

router.post('/', authorize('teacher', 'admin'), createProgress);
router.get('/student/:studentId', authorize('teacher', 'admin', 'parent'), getProgressByStudent);
router.put('/:id', authorize('teacher', 'admin'), updateProgress);
router.delete('/:id', authorize('teacher', 'admin'), deleteProgress);

module.exports = router;
