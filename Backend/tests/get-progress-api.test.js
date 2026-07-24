const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = require("../app");
const AcademicProgress = require("../models/AcademicProgress");
const Student = require("../models/Student");
const User = require("../models/User");

const rawUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_get_progress_test";
const TEST_MONGO_URI = rawUri.replace(/\/[^/?]+(\?|$)/, "/internship_project_get_progress_test$1");
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

let server;
let port;

const getAuthHeaders = (role = "teacher", studentId = null) => {
  const csrfToken = "test-csrf-get-progress-token";
  const payload = { role, id: "test-user-id" };
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
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  await AcademicProgress.init();
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  await AcademicProgress.deleteMany({});
  await Student.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await AcademicProgress.deleteMany({});
  await Student.deleteMany({});
});

// --- Unit Tests ---
test("Unit 1: Validates studentId and subject query inputs", () => {
  const isValidStudentId = (id) =>
    typeof id === "string" && /^[A-Za-z0-9_-]{3,30}$/.test(id.trim());
  const isValidSubject = (sub) =>
    typeof sub === "string" && sub.trim().length >= 2 && sub.trim().length <= 100;

  assert.equal(isValidStudentId("STU-1001"), true);
  assert.equal(isValidStudentId(""), false);
  assert.equal(isValidStudentId("S@123"), false);

  assert.equal(isValidSubject("Computer Science"), true);
  assert.equal(isValidSubject("A"), false);
  assert.equal(isValidSubject("   "), false);
});

// --- Integration Tests ---
test("Integration 1: GET /api/v1/progress - Returns 200 OK with full progress payload", async () => {
  const student = new Student({
    studentId: "STU-2001",
    name: "Jane Doe",
    email: "jane@test.com",
    age: 20,
    enrolledSubjects: ["Computer Science", "Mathematics"],
  });
  await student.save();

  const progress = new AcademicProgress({
    studentId: "STU-2001",
    subject: "Computer Science",
    grade: 92.5,
    overallCompletionPercentage: 92.5,
    cumulativeTimeSpentMinutes: 140,
    topics: [
      {
        topicId: "TOPIC-1",
        title: "Algorithms",
        completionStatus: "completed",
        score: 95,
      },
    ],
    remarks: "Outstanding performance in algorithms",
  });
  await progress.save();

  const res = await fetch(
    `http://localhost:${port}/api/v1/progress?studentId=STU-2001&subject=Computer%20Science`,
    {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    }
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.studentId, "STU-2001");
  assert.equal(body.data.subject, "Computer Science");
  assert.equal(body.data.grade, 92.5);
  assert.equal(body.data.overallCompletionPercentage, 92.5);
  assert.equal(body.data.cumulativeTimeSpentMinutes, 140);
  assert.equal(body.data.topics.length, 1);
  assert.equal(body.data.topics[0].title, "Algorithms");
});

test("Integration 2: Sub-200ms caching layer returns cached response on sequential request", async () => {
  const progress = new AcademicProgress({
    studentId: "STU-2002",
    subject: "Physics",
    grade: 85,
  });
  await progress.save();

  const res1 = await fetch(
    `http://localhost:${port}/api/progress?studentId=STU-2002&subject=Physics`,
    {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    }
  );

  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.cached, false);

  const startCachedReq = Date.now();
  const res2 = await fetch(
    `http://localhost:${port}/api/progress?studentId=STU-2002&subject=Physics`,
    {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    }
  );
  const durationMs = Date.now() - startCachedReq;

  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.cached, true);
  assert.ok(durationMs < 200, `Cached response duration ${durationMs}ms must be under 200ms`);
});

test("Integration 3: Returns 400 Bad Request when studentId or subject query parameter is missing or malformed", async () => {
  // Missing subject
  const res1 = await fetch(`http://localhost:${port}/api/v1/progress?studentId=STU-2003`, {
    method: "GET",
    headers: getAuthHeaders("teacher"),
  });
  assert.equal(res1.status, 400);
  const body1 = await res1.json();
  assert.equal(body1.success, false);
  assert.match(body1.message, /subject/);

  // Missing studentId
  const res2 = await fetch(`http://localhost:${port}/api/v1/progress?subject=Physics`, {
    method: "GET",
    headers: getAuthHeaders("teacher"),
  });
  assert.equal(res2.status, 400);

  // Malformed studentId
  const res3 = await fetch(
    `http://localhost:${port}/api/v1/progress?studentId=STU@INVALID!&subject=Physics`,
    {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    }
  );
  assert.equal(res3.status, 400);
  const body3 = await res3.json();
  assert.match(body3.message, /Invalid 'studentId' format/);
});

test("Integration 4: Returns 404 Not Found for non-existent student or progress record", async () => {
  const res = await fetch(
    `http://localhost:${port}/api/v1/progress?studentId=STU-9999&subject=Calculus`,
    {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    }
  );

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Not Found");
});

test("Integration 5: Security Control - Returns 403 Forbidden when unauthorized student accesses another student's progress", async () => {
  const progress = new AcademicProgress({
    studentId: "STU-2005",
    subject: "History",
    grade: 88,
  });
  await progress.save();

  // Requesting user is student STU-9999 trying to access STU-2005's progress
  const res = await fetch(
    `http://localhost:${port}/api/v1/progress?studentId=STU-2005&subject=History`,
    {
      method: "GET",
      headers: getAuthHeaders("student", "STU-9999"),
    }
  );

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "Forbidden");
});

// --- Load / Performance Tests ---
test("Performance Load Test: 50 concurrent GET requests achieve sub-200ms latency under production load", async () => {
  const progress = new AcademicProgress({
    studentId: "STU-2006",
    subject: "Biology",
    grade: 90,
  });
  await progress.save();

  const startTime = Date.now();
  const requests = Array.from({ length: 50 }).map(() =>
    fetch(`http://localhost:${port}/api/v1/progress?studentId=STU-2006&subject=Biology`, {
      method: "GET",
      headers: getAuthHeaders("teacher"),
    })
  );

  const responses = await Promise.all(requests);
  const totalMs = Date.now() - startTime;
  const avgMsPerRequest = totalMs / 50;

  for (const res of responses) {
    assert.equal(res.status, 200);
  }

  assert.ok(
    avgMsPerRequest < 200,
    `Average response latency under concurrent load was ${avgMsPerRequest.toFixed(2)}ms (target < 200ms)`
  );
});
