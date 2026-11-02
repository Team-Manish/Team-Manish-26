var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const crypto = require("crypto");

const dotenv = require("dotenv");
const connectDB = require("./config/db");
const studentsRouter = require("./routes/students");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const teacherRouter = require("./routes/teacher");
const parentRouter = require("./routes/parent");
const progressRouter = require("./routes/progress");
const attendanceRouter = require("./routes/attendance");

dotenv.config();

connectDB().catch((err) => {
  console.error("Initial MongoDB Connection Rejection:", err.message);
});

var app = express();

// Security and CORS middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(xss());
app.use(cookieParser());

// CSRF Protection middleware
const generateCsrfToken = () => crypto.randomBytes(32).toString("hex");

app.use((req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfTokenFromCookie = req.cookies["XSRF-TOKEN"];
  const csrfTokenFromHeader = req.headers["x-xsrf-token"];

  if (!csrfTokenFromCookie || !csrfTokenFromHeader || csrfTokenFromCookie !== csrfTokenFromHeader) {
    return res.status(403).json({ success: false, error: "Forbidden", message: "Invalid CSRF token" });
  }

  next();
});

// Endpoint to get CSRF token
app.get("/api/csrf-token", (req, res) => {
  const csrfToken = generateCsrfToken();
  res.cookie("XSRF-TOKEN", csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  res.json({ success: true, csrfToken });
});

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    success: false,
    error: "Too Many Requests",
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Redact sensitive tokens from URLs in access logs (Defense-in-depth)
logger.token("url", (req) => {
  const rawUrl = req.originalUrl || req.url || "";
  return rawUrl
    .replace(/([?&]token=)[^&]+/gi, "$1[REDACTED]")
    .replace(/(\/validate-reset-token\/)[^/?#]+/gi, "$1[REDACTED]");
});

app.use(logger("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
const frontendDistPath = path.join(__dirname, "../Frontend/dist");
app.use(express.static(frontendDistPath));

app.use("/students", studentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/parent", parentRouter);
app.use("/api/progress", progressRouter);
app.use("/api/v1/progress", progressRouter);
app.use("/api/attendance", attendanceRouter);

// SPA Client-Side Fallback for single-origin hosting
app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/students")) {
    return next(createError(404));
  }
  const indexPath = path.join(frontendDistPath, "index.html");
  const fs = require("fs");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next(createError(404));
});

app.use(function (err, req, res, next) {
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.status === 404 ? "Not Found" : "Internal Server Error",
      message: err.message,
    });
  }

  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
