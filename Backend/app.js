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

dotenv.config();

connectDB();

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
    return res.status(403).json({ success: false, message: "Invalid CSRF token" });
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
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));


app.use("/students", studentsRouter);
app.use("/api/auth", loginLimiter, authRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;