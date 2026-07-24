const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const app = require("../app");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_unauthorized_test";
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
  await User.deleteMany({ email: /@unauthorized-validation-domain\.com$/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@unauthorized-validation-domain\.com$/ });
});

// Helper to construct test accounts and JWT tokens
const createTestUser = async (email, role, status = "active") => {
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

// CSRF headers helper for state-changing HTTP methods (POST, PUT, DELETE)
const getHeaders = (token) => {
  const csrfToken = "test-csrf-token-unauthorized-suite";
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  headers["Cookie"] = `XSRF-TOKEN=${csrfToken}`;
  headers["x-xsrf-token"] = csrfToken;
  headers["Content-Type"] = "application/json";
  return headers;
};

// Helper assertion function to verify strict 403 Forbidden payload structure and zero data leakage
const assertForbiddenResponse = async (res, targetEndpoint, method) => {
  assert.equal(
    res.status,
    403,
    `Expected HTTP status 403 Forbidden for unauthorized ${method} ${targetEndpoint}, but got ${res.status}`
  );

  const body = await res.json();

  // Validate standardized JSON payload structure
  assert.equal(body.success, false, "Response body must contain 'success: false'");
  assert.equal(body.error, "Forbidden", "Response body must contain 'error: Forbidden'");
  assert.equal(typeof body.message, "string", "Response body must contain descriptive error message");

  // Validate zero sensitive data leakage
  assert.equal(body.user, undefined, "Unauthorized response payload must not leak user object");
  assert.equal(body.stats, undefined, "Unauthorized response payload must not leak system stats");
  assert.equal(body.classes, undefined, "Unauthorized response payload must not leak class list");
  assert.equal(body.children, undefined, "Unauthorized response payload must not leak children records");
  assert.equal(body.settings, undefined, "Unauthorized response payload must not leak settings data");
};

test("1. Incorrect Role Access Matrix: GET, POST, PUT, DELETE requests on Admin routes by non-admin roles return strict 403 Forbidden", async () => {
  const standardUser = await createTestUser("user@unauthorized-validation-domain.com", "user");
  const teacherUser = await createTestUser("teacher@unauthorized-validation-domain.com", "teacher");
  const parentUser = await createTestUser("parent@unauthorized-validation-domain.com", "parent");

  const adminEndpoints = [
    { method: "GET", url: "/api/admin/dashboard" },
    { method: "GET", url: "/api/admin/users" },
    { method: "POST", url: "/api/admin/system-settings", body: { maintenanceMode: true } },
    { method: "PUT", url: `/api/admin/users/${standardUser.user._id}/status`, body: { status: "suspended" } },
    { method: "DELETE", url: `/api/admin/users/${standardUser.user._id}` },
  ];

  const unauthorizedTestAccounts = [
    { role: "user", token: standardUser.token },
    { role: "teacher", token: teacherUser.token },
    { role: "parent", token: parentUser.token },
  ];

  for (const account of unauthorizedTestAccounts) {
    for (const endpoint of adminEndpoints) {
      const res = await fetch(`http://localhost:${port}${endpoint.url}`, {
        method: endpoint.method,
        headers: getHeaders(account.token),
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      });

      await assertForbiddenResponse(res, endpoint.url, endpoint.method);
    }
  }
});

test("2. Incorrect Role Access Matrix: GET, POST, PUT, DELETE requests on Teacher routes by non-teacher roles return strict 403 Forbidden", async () => {
  const standardUser = await createTestUser("user2@unauthorized-validation-domain.com", "user");
  const parentUser = await createTestUser("parent2@unauthorized-validation-domain.com", "parent");

  const teacherEndpoints = [
    { method: "GET", url: "/api/teacher/classes" },
    { method: "POST", url: "/api/teacher/grades", body: { studentId: "123", subject: "Math", grade: "A" } },
    { method: "PUT", url: "/api/teacher/grades/REC-101", body: { grade: "A+" } },
    { method: "DELETE", url: "/api/teacher/assignments/ASSIGN-5" },
  ];

  const unauthorizedAccounts = [
    { role: "user", token: standardUser.token },
    { role: "parent", token: parentUser.token },
  ];

  for (const account of unauthorizedAccounts) {
    for (const endpoint of teacherEndpoints) {
      const res = await fetch(`http://localhost:${port}${endpoint.url}`, {
        method: endpoint.method,
        headers: getHeaders(account.token),
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      });

      await assertForbiddenResponse(res, endpoint.url, endpoint.method);
    }
  }
});

test("3. Incorrect Role Access Matrix: GET, POST, PUT, DELETE requests on Parent routes by non-parent roles return strict 403 Forbidden", async () => {
  const standardUser = await createTestUser("user3@unauthorized-validation-domain.com", "user");
  const teacherUser = await createTestUser("teacher3@unauthorized-validation-domain.com", "teacher");

  const parentEndpoints = [
    { method: "GET", url: "/api/parent/children" },
    { method: "GET", url: "/api/parent/attendance" },
    { method: "POST", url: "/api/parent/feedback", body: { feedback: "Great school" } },
    { method: "PUT", url: "/api/parent/profile", body: { phone: "555-0199" } },
    { method: "DELETE", url: "/api/parent/notifications/NOTIF-12" },
  ];

  const unauthorizedAccounts = [
    { role: "user", token: standardUser.token },
    { role: "teacher", token: teacherUser.token },
  ];

  for (const account of unauthorizedAccounts) {
    for (const endpoint of parentEndpoints) {
      const res = await fetch(`http://localhost:${port}${endpoint.url}`, {
        method: endpoint.method,
        headers: getHeaders(account.token),
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      });

      await assertForbiddenResponse(res, endpoint.url, endpoint.method);
    }
  }
});

test("4. Layered Edge Case: Unauthenticated requests to restricted endpoints return 401 Unauthorized", async () => {
  const res = await fetch(`http://localhost:${port}/api/admin/dashboard`);
  assert.equal(res.status, 401);

  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Unauthorized");
  assert.match(body.message, /Missing authentication token/);
});

test("5. Layered Edge Case: Expired JWT token returns 401 Unauthorized", async () => {
  const expiredToken = jwt.sign(
    { id: new mongoose.Types.ObjectId(), role: "admin" },
    JWT_SECRET,
    { expiresIn: "-1s" }
  );

  const res = await fetch(`http://localhost:${port}/api/admin/dashboard`, {
    headers: getHeaders(expiredToken),
  });

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Unauthorized");
  assert.match(body.message, /Authentication token has expired/);
});

test("6. Layered Edge Case: Suspended or inactive account status returns 403 Forbidden", async () => {
  const suspendedAdmin = await createTestUser("suspendedadmin@unauthorized-validation-domain.com", "admin", "suspended");

  const res = await fetch(`http://localhost:${port}/api/admin/dashboard`, {
    headers: getHeaders(suspendedAdmin.token),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Forbidden");
  assert.match(body.message, /Account is inactive or suspended/);
});
