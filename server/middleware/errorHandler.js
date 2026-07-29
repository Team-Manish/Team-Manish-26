const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: messages,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
    });
  }

  if (err.name === 'MongoServerError') {
    console.error('MongoServerError details:', {
      code: err.code,
      errmsg: err.errmsg,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue,
    });
    return res.status(500).json({
      success: false,
      message: err.errmsg || 'Database error occurred',
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
