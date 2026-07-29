const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const validateBulkAttendance = [
  body('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid Class ID format'),

  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        throw new Error('Cannot mark attendance for a future date');
      }
      return true;
    }),

  body('records')
    .isArray({ min: 1 })
    .withMessage('At least one attendance record is required'),

  body('records.*.studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid Student ID format'),

  body('records.*.status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['present', 'absent', 'late', 'excused'])
    .withMessage('Status must be present, absent, late, or excused'),

  body('records.*.remarks')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Remarks cannot exceed 200 characters'),

  handleValidationErrors,
];

const validateGetAttendance = [
  query('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid Class ID format'),

  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),

  handleValidationErrors,
];

const validateDateRange = [
  query('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid Class ID format'),

  query('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),

  query('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  handleValidationErrors,
];

const validateStudentAttendance = [
  param('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid Student ID format'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  handleValidationErrors,
];

const validateDeleteAttendance = [
  query('classId')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid Class ID format'),
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  handleValidationErrors,
];

module.exports = {
  validateBulkAttendance,
  validateGetAttendance,
  validateDateRange,
  validateStudentAttendance,
  validateDeleteAttendance,
};
