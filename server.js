const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./db');
const errorHandler = require('./server/middleware/errorHandler');
const authRoutes = require('./server/routes/auth');
const attendanceRoutes = require('./server/routes/attendance');
const progressRoutes = require('./server/routes/progress');
const classRoutes = require('./server/routes/class');
const studentRoutes = require('./server/routes/student');
const userRoutes = require('./server/routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', userRoutes);

app.use('/api/:path', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
