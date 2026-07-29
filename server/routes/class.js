const express = require('express');
const router = express.Router();
const { getClasses, getClassById, createClass } = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getClasses);
router.get('/:id', getClassById);
router.post('/', authorize('admin', 'teacher'), createClass);

module.exports = router;
