const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const parentRoutes = require("./routes/parent");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/students");
const progressRoutes = require("./routes/progress");
const attendanceRoutes = require("./routes/attendance");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF token endpoint stub for tests & security handshake
app.get("/api/csrf-token", (req, res) => {
  const token = "mock-csrf-token-" + Date.now();
  res.cookie("XSRF-TOKEN", token, { httpOnly: false, path: "/" });
  res.json({ csrfToken: token });
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/attendance", attendanceRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.name || "Internal Server Error",
    message: err.message || "An unexpected error occurred",
  });
});

module.exports = app;
