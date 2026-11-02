const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const app = require("../app");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_routes_test";
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
  await User.deleteMany({ email: /@test-routes-domain\.com$/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@test-routes-domain\.com$/ });
});

// Helper to create user and signed JWT token
const createTestAccount = async (email, role, status = "active") => {
  const user = new User({
    email,
    password: "password123",
    role,
    status,
  });
  await user.save();

  const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
  return { user, token };
};

test("1. Admin Route: Grants access to admin users and blocks unauthorized roles with 403 Forbidden", async () => {
  const adminAccount = await createTestAccount("admin@test-routes-domain.com", "admin");
  const teacherAccount = await createTestAccount("teacher_try_admin@test-routes-domain.com", "teacher");
  const parentAccount = await createTestAccount("parent_try_admin@test-routes-domain.com", "parent");

  // Admin access -> 200 OK
  const adminRes = await fetch(`http://localhost:${port}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminAccount.token}` },
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.equal(adminData.success, true);
  assert.equal(adminData.message, "Admin Dashboard Access Granted");

  // Teacher trying to access Admin route -> 403 Forbidden
  const teacherRes = await fetch(`http://localhost:${port}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${teacherAccount.token}` },
  });
  assert.equal(teacherRes.status, 403);
  const teacherData = await teacherRes.json();
  assert.equal(teacherData.success, false);
  assert.equal(teacherData.error, "Forbidden");
  assert.match(teacherData.message, /Insufficient permissions/);

  // Parent trying to access Admin route -> 403 Forbidden
  const parentRes = await fetch(`http://localhost:${port}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${parentAccount.token}` },
  });
  assert.equal(parentRes.status, 403);
  const parentData = await parentRes.json();
  assert.equal(parentData.success, false);
  assert.equal(parentData.error, "Forbidden");
});

test("2. Teacher Route: Grants access exclusively to teacher users and blocks parent & standard user accounts", async () => {
  const teacherAccount = await createTestAccount("teacher@test-routes-domain.com", "teacher");
  const parentAccount = await createTestAccount("parent_try_teacher@test-routes-domain.com", "parent");
  const userAccount = await createTestAccount("user_try_teacher@test-routes-domain.com", "user");

  // Teacher access -> 200 OK
  const teacherRes = await fetch(`http://localhost:${port}/api/teacher/classes`, {
    headers: { Authorization: `Bearer ${teacherAccount.token}` },
  });
  assert.equal(teacherRes.status, 200);
  const teacherData = await teacherRes.json();
  assert.equal(teacherData.success, true);
  assert.equal(teacherData.message, "Teacher Portal: Classes Overview");

  // Parent trying to access Teacher route -> 403 Forbidden
  const parentRes = await fetch(`http://localhost:${port}/api/teacher/classes`, {
    headers: { Authorization: `Bearer ${parentAccount.token}` },
  });
  assert.equal(parentRes.status, 403);
  const parentData = await parentRes.json();
  assert.equal(parentData.success, false);
  assert.equal(parentData.error, "Forbidden");

  // User trying to access Teacher route -> 403 Forbidden
  const userRes = await fetch(`http://localhost:${port}/api/teacher/classes`, {
    headers: { Authorization: `Bearer ${userAccount.token}` },
  });
  assert.equal(userRes.status, 403);
});

test("3. Parent Route: Grants access exclusively to parent accounts and blocks teacher & cross-role access", async () => {
  const parentAccount = await createTestAccount("parent@test-routes-domain.com", "parent");
  const teacherAccount = await createTestAccount("teacher_try_parent@test-routes-domain.com", "teacher");
  const userAccount = await createTestAccount("user_try_parent@test-routes-domain.com", "user");

  // Parent access -> 200 OK
  const parentRes = await fetch(`http://localhost:${port}/api/parent/children`, {
    headers: { Authorization: `Bearer ${parentAccount.token}` },
  });
  assert.equal(parentRes.status, 200);
  const parentData = await parentRes.json();
  assert.equal(parentData.success, true);
  assert.equal(parentData.message, "Parent Portal: Children Summary");

  // Teacher trying to access Parent route -> 403 Forbidden
  const teacherRes = await fetch(`http://localhost:${port}/api/parent/children`, {
    headers: { Authorization: `Bearer ${teacherAccount.token}` },
  });
  assert.equal(teacherRes.status, 403);
  const teacherData = await teacherRes.json();
  assert.equal(teacherData.success, false);
  assert.equal(teacherData.error, "Forbidden");

  // User trying to access Parent route -> 403 Forbidden
  const userRes = await fetch(`http://localhost:${port}/api/parent/children`, {
    headers: { Authorization: `Bearer ${userAccount.token}` },
  });
  assert.equal(userRes.status, 403);
});

test("4. Missing or Unauthenticated requests return standardized 401 Unauthorized JSON error", async () => {
  const res = await fetch(`http://localhost:${port}/api/admin/dashboard`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Unauthorized");
  assert.match(data.message, /Missing authentication token/);
});

test("5. Non-existent API route returns standardized 404 Not Found JSON error", async () => {
  const res = await fetch(`http://localhost:${port}/api/non-existent-endpoint`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Not Found");
});
