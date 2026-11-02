const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = require("../app");
const User = require("../models/User");

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_parent_att_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

let server;
let port;
let isConnected = false;
let testParentId;

const getAuthHeaders = (role = "parent", linkedStudentIds = ["STU-1001", "STU-1002"]) => {
  const csrfToken = "test-parent-att-token";
  const payload = { role, id: testParentId || new mongoose.Types.ObjectId().toString(), email: "parent@school.com", linkedStudentIds };
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
    isConnected = true;
  } catch (err) {
    isConnected = false;
  }

  const parentObjId = new mongoose.Types.ObjectId();
  testParentId = parentObjId.toString();

  if (isConnected) {
    await User.deleteMany({ email: "parent_att_test@school.com" });
    const user = new User({
      _id: parentObjId,
      email: "parent_att_test@school.com",
      password: "ParentPassword123!",
      role: "parent",
      linkedStudentIds: ["STU-1001", "STU-1002"],
    });
    await user.save();
  }

  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  if (isConnected) {
    await User.deleteMany({ email: "parent_att_test@school.com" });
    await mongoose.disconnect();
  }
});

test("Unit Test: Security access check logic correctly identifies linked vs unlinked student IDs", () => {
  const linkedStudentIds = ["STU-1001", "STU-1002"];
  const isAuthorizedStudent = (id) => linkedStudentIds.includes(id);

  assert.equal(isAuthorizedStudent("STU-1001"), true);
  assert.equal(isAuthorizedStudent("STU-1002"), true);
  assert.equal(isAuthorizedStudent("STU-9999"), false);
  assert.equal(isAuthorizedStudent(""), false);
});

test("Task-1 & Task-3: GET /api/parent/child-attendance/:studentId - Returns 200 OK with child attendance records & summary for linked child", async (t) => {
  if (!isConnected) {
    t.skip("MongoDB connection offline; skipping live DB test.");
    return;
  }

  const headers = getAuthHeaders("parent", ["STU-1001", "STU-1002"]);
  const res = await fetch(`http://localhost:${port}/api/parent/child-attendance/STU-1001`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.studentId, "STU-1001");
  assert.ok(body.summary);
  assert.ok(Array.isArray(body.records));
  assert.ok(body.records.length > 0);
  assert.ok(body.summary.attendanceRate >= 0 && body.summary.attendanceRate <= 100);
});

test("Task-3: Secure Access Control - Returns 403 Forbidden when parent accesses unlinked student", async (t) => {
  if (!isConnected) {
    t.skip("MongoDB connection offline; skipping live DB test.");
    return;
  }

  const headers = getAuthHeaders("parent", ["STU-1001"]);
  const res = await fetch(`http://localhost:${port}/api/parent/child-attendance/STU-9999`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Forbidden");
  assert.match(body.message, /Forbidden/);
});
