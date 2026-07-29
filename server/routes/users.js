const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin'), async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = { isActive: true };
    if (role) filter.role = role;
    const users = await User.find(filter).select('name email role');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
