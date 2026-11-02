const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const app = require("../app");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_progress_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

let server;
let port;

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  await User.deleteMany({ email: /@test-progress-domain\.com$/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@test-progress-domain\.com$/ });
});

const getTeacherAuthHeaders = async (email = "teacher@test-progress-domain.com") => {
  const teacherUser = new User({
    email,
    password: "password123",
    role: "teacher",
    status: "active",
  });
  await teacherUser.save();

  const token = jwt.sign({ id: teacherUser._id, email: teacherUser.email, role: teacherUser.role }, JWT_SECRET);
  const csrfToken = "test-csrf-progress-token";

  return {
    Authorization: `Bearer ${token}`,
    Cookie: `XSRF-TOKEN=${csrfToken}`,
    "x-xsrf-token": csrfToken,
    "Content-Type": "application/json",
  };
};

test("1. POST /api/teacher/progress: Accepts valid progress payload and returns 201 Created", async () => {
  const headers = await getTeacherAuthHeaders("validprogress@test-progress-domain.com");
  const payload = {
    progressPercentage: 85,
    taskId: "TASK-8080",
    statusIdentifier: "in_progress",
    message: "Module 4 completed",
    timestamp: new Date().toISOString(),
    metadata: { courseId: "CS101" },
  };

  const res = await fetch(`http://localhost:${port}/api/teacher/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.match(data.message, /Progress update of 85% recorded/);
  assert.equal(data.data.progressPercentage, 85);
  assert.equal(data.data.taskId, "TASK-8080");
  assert.equal(data.data.statusIdentifier, "in_progress");
});

test("2. POST /api/teacher/progress: Rejects invalid or out-of-range progressPercentage with 400 Bad Request", async () => {
  const headers = await getTeacherAuthHeaders("invalidpercentage@test-progress-domain.com");
  const payload = {
    progressPercentage: 150, // Out of bounds > 100
    taskId: "TASK-8080",
    statusIdentifier: "in_progress",
  };

  const res = await fetch(`http://localhost:${port}/api/teacher/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Bad Request");
  assert.match(data.message, /Must be a number between 0 and 100/);
});

test("3. POST /api/teacher/progress: Rejects missing taskId with 400 Bad Request", async () => {
  const headers = await getTeacherAuthHeaders("missingtask@test-progress-domain.com");
  const payload = {
    progressPercentage: 50,
    taskId: "",
    statusIdentifier: "in_progress",
  };

  const res = await fetch(`http://localhost:${port}/api/teacher/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Invalid or missing 'taskId'/);
});

test("4. POST /api/teacher/progress: Rejects unauthorized parent user with 403 Forbidden", async () => {
  const parentUser = new User({
    email: "parentuser@test-progress-domain.com",
    password: "password123",
    role: "parent",
    status: "active",
  });
  await parentUser.save();

  const token = jwt.sign({ id: parentUser._id, email: parentUser.email, role: parentUser.role }, JWT_SECRET);
  const csrfToken = "test-csrf-progress-token";

  const headers = {
    Authorization: `Bearer ${token}`,
    Cookie: `XSRF-TOKEN=${csrfToken}`,
    "x-xsrf-token": csrfToken,
    "Content-Type": "application/json",
  };

  const res = await fetch(`http://localhost:${port}/api/teacher/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      progressPercentage: 50,
      taskId: "TASK-100",
      statusIdentifier: "in_progress",
    }),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Forbidden");
});
