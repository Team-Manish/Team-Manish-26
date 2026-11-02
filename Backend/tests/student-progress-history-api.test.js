const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = require("../app");
const AcademicProgress = require("../models/AcademicProgress");
const Student = require("../models/Student");

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_history_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

let server;
let port;

const getAuthHeaders = (role = "teacher", studentId = null) => {
  const csrfToken = "test-csrf-history-token";
  const payload = { role, id: "test-teacher-id" };
  if (studentId) payload.studentId = studentId;
  const token = jwt.sign(payload, JWT_SECRET);

  return {
    Authorization: `Bearer ${token}`,
    Cookie: `XSRF-TOKEN=${csrfToken}`,
    "x-xsrf-token": csrfToken,
    "Content-Type": "application/json",
  };
};

before(async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    }
    await AcademicProgress.init();
  } catch (err) {
    console.warn("MongoDB connection skipped for unit tests:", err.message);
  }
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  if (mongoose.connection.readyState !== 0) {
    await AcademicProgress.deleteMany({});
    await Student.deleteMany({});
    await mongoose.disconnect();
  }
});

test("Unit Test: Student ID validation logic for history endpoint", () => {
  const isValidStudentId = (id) =>
    typeof id === "string" && /^[A-Za-z0-9_-]{3,30}$/.test(id.trim());

  assert.equal(isValidStudentId("STU-1001"), true);
  assert.equal(isValidStudentId("STU_2026"), true);
  assert.equal(isValidStudentId(""), false);
  assert.equal(isValidStudentId("S@Invalid!"), false);
});

test("Integration Test: GET /api/progress/student/:studentId returns 400 for malformed student ID", async () => {
  const res = await fetch(`http://localhost:${port}/api/progress/student/STU@INVALID!`, {
    method: "GET",
    headers: getAuthHeaders("teacher"),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Invalid 'studentId' format/);
});

test("Integration Test: GET /api/progress/student/:studentId returns 403 when unauthorized student requests other student's data", async () => {
  const res = await fetch(`http://localhost:${port}/api/progress/student/STU-1001`, {
    method: "GET",
    headers: getAuthHeaders("student", "STU-9999"),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Forbidden");
});
