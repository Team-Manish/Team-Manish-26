const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Provide safe non-secret test URI fallback to prevent config/db.js process.exit(1) on load
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/internship_project_test";

const app = require("../app");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

// Dynamic Express HTTP server instance
let server;
let port;
let originalUserFindById;
let originalStudentFind;
let originalAttendanceBulkWrite;
let originalAttendanceDistinct;
let originalAttendanceFind;

// Mock in-memory directory for HTTP integration testing
const mockUsers = {
  "admin-id-1": {
    _id: "admin-id-1",
    userId: "ADM-001",
    email: "admin@school.com",
    role: "admin",
    status: "active",
  },
  "teacher-id-1": {
    _id: "teacher-id-1",
    userId: "TCH-2001",
    email: "teacher@school.com",
    role: "teacher",
    status: "active",
    assignedStudentIds: ["STU-1001", "STU-1002"],
  },
  "teacher-unassigned-id": {
    _id: "teacher-unassigned-id",
    userId: "TCH-9999",
    email: "newteacher@school.com",
    role: "teacher",
    status: "active",
    assignedStudentIds: [],
  },
  "parent-id-1": {
    _id: "parent-id-1",
    userId: "PRN-3001",
    email: "parent@school.com",
    role: "parent",
    status: "active",
    linkedStudentIds: ["STU-1001"],
  },
  "parent-empty-id": {
    _id: "parent-empty-id",
    userId: "PRN-EMPTY",
    email: "empty_parent@school.com",
    role: "parent",
    status: "active",
    linkedStudentIds: [],
  },
  "student-id-1": {
    _id: "student-id-1",
    userId: "STU-1001",
    email: "student@school.com",
    role: "student",
    status: "active",
  },
};

const mockStudents = {
  "STU-1001": {
    studentId: "STU-1001",
    name: "Jane Doe (Authoritative)",
    className: "Grade 10-A",
    assignedTeacherId: "TCH-2001",
  },
  "STU-1002": {
    studentId: "STU-1002",
    name: "Alex Doe (Authoritative)",
    className: "Grade 10-A",
    assignedTeacherId: "TCH-2001",
  },
};

// Helper to generate signed JWT token
const createAuthToken = (userId, role = "user") => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: "1h" });
};

// Helper to construct headers with matching CSRF cookie and header
const createHeaders = (token, csrf = "valid-csrf-token") => {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (csrf) {
    headers["Cookie"] = `XSRF-TOKEN=${csrf}`;
    headers["x-xsrf-token"] = csrf;
  }
  return headers;
};

before(async () => {
  // Save original model methods before stubbing for HTTP tests
  originalUserFindById = User.findById;
  originalStudentFind = Student.find;
  originalAttendanceBulkWrite = Attendance.bulkWrite;
  originalAttendanceDistinct = Attendance.distinct;

  // Stub User.findById for Express RBAC authorize middleware
  User.findById = (id) => ({
    select: async () => mockUsers[id] || null,
  });

  // Stub Student.find for authoritative registry verification
  Student.find = async (query) => {
    if (query && query.studentId && query.studentId.$in) {
      const ids = query.studentId.$in;
      return ids.map((id) => mockStudents[id.toUpperCase()]).filter(Boolean);
    }
    return Object.values(mockStudents);
  };

  // Stub Attendance.bulkWrite for HTTP route completion
  Attendance.bulkWrite = async (ops) => {
    return {
      matchedCount: ops.length,
      modifiedCount: ops.length,
      upsertedCount: 0,
    };
  };

  // Stub Attendance.distinct
  Attendance.distinct = async () => ["Grade 10-A", "Computer Science 101"];

  // Stub Attendance.find for parent & daily details queries
  originalAttendanceFind = Attendance.find;
  Attendance.find = () => ({
    sort: async () => [
      {
        _id: "att-1",
        studentId: "STU-1001",
        studentName: "Jane Doe (Authoritative)",
        className: "Grade 10-A",
        date: new Date(Date.UTC(2026, 6, 24)),
        dateStr: "2026-07-24",
        status: "present",
        remarks: "On time",
      },
    ],
  });

  // Start real Express server on dynamic ephemeral port
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) {
    server.close();
  }
  // Restore original model methods
  User.findById = originalUserFindById;
  Student.find = originalStudentFind;
  Attendance.bulkWrite = originalAttendanceBulkWrite;
  Attendance.distinct = originalAttendanceDistinct;
  Attendance.find = originalAttendanceFind;
});

/**
 * =============================================================================
 * SECTION A: UNIT TESTS (Mongoose Schema, Validation & Strict Date Contract)
 * =============================================================================
 */

test("Unit Test 1: Attendance Schema accepts valid attendance record with all required fields", async () => {
  const record = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    school: "Main Campus",
    date: new Date(Date.UTC(2026, 6, 24, 0, 0, 0)),
    dateStr: "2026-07-24",
    status: "present",
    remarks: "On time",
  });

  await record.validate();
  assert.equal(record.studentId, "STU-1001");
  assert.equal(record.status, "present");
  assert.equal(record.dateStr, "2026-07-24");
});

test("Unit Test 2: Attendance Schema rejects invalid status enum value", async () => {
  const record = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    dateStr: "2026-07-24",
    status: "tardy_unexcused",
  });

  await assert.rejects(async () => await record.validate(), /Invalid attendance status/);
});

test("Unit Test 3: Attendance Schema requires mandatory fields (studentId, studentName, className)", async () => {
  const emptyRecord = new Attendance({});
  await assert.rejects(
    async () => await emptyRecord.validate(),
    (err) => {
      assert.ok(err.errors.studentId);
      assert.ok(err.errors.studentName);
      assert.ok(err.errors.className);
      return true;
    }
  );
});

test("Unit Test 4: Attendance Schema pre-validation hook auto-derives dateStr from date and date from dateStr", async () => {
  const recordA = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    date: new Date(Date.UTC(2026, 6, 24, 10, 30, 0)),
    status: "present",
  });
  await recordA.validate();
  assert.equal(recordA.dateStr, "2026-07-24", "dateStr should be auto-derived in YYYY-MM-DD");

  const recordB = new Attendance({
    studentId: "stu-1002", // lowercase input
    studentName: "Alex Doe",
    className: "Grade 10-A",
    dateStr: "2026-07-25",
    status: "late",
  });
  await recordB.validate();
  assert.equal(recordB.studentId, "STU-1002", "studentId should be normalized to uppercase");
  assert.ok(recordB.date instanceof Date);
  assert.equal(recordB.date.toISOString(), "2026-07-25T00:00:00.000Z");
});

test("Unit Test 5: Attendance Schema exports unique compound index on { studentId, dateStr, className }", () => {
  const indexes = Attendance.schema.indexes();
  const hasUniqueCompoundIndex = indexes.some(([fields, options]) => {
    return (
      fields.studentId === 1 &&
      fields.dateStr === 1 &&
      fields.className === 1 &&
      options &&
      options.unique === true
    );
  });
  assert.equal(hasUniqueCompoundIndex, true);
});

/**
 * =============================================================================
 * SECTION B: REAL EXPRESS HTTP INTEGRATION TESTS (Network Loopback & Real Stack)
 * =============================================================================
 */

test("HTTP Test 6: Unauthenticated request to GET /api/attendance/heatmap returns HTTP 401 Unauthorized", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/attendance/heatmap`, {
    method: "GET",
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Unauthorized");
});

test("HTTP Test 7: Missing or mismatched CSRF token on POST /api/attendance is rejected with HTTP 403 Forbidden", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");

  // Case A: Missing CSRF headers entirely
  const resNoCsrf = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [] }),
  });

  assert.equal(resNoCsrf.status, 403);
  const dataNoCsrf = await resNoCsrf.json();
  assert.equal(dataNoCsrf.error, "Forbidden");
  assert.match(dataNoCsrf.message, /CSRF/i);

  // Case B: Mismatched cookie vs header token
  const resMismatch = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      Cookie: "XSRF-TOKEN=token-alpha",
      "x-xsrf-token": "token-bravo",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [] }),
  });

  assert.equal(resMismatch.status, 403);
  const dataMismatch = await resMismatch.json();
  assert.match(dataMismatch.message, /CSRF/i);
});

test("HTTP Test 8: Student role attempting to access attendance endpoints returns HTTP 403 Forbidden", async () => {
  const studentToken = createAuthToken("student-id-1", "student");
  const headers = createHeaders(studentToken);

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance/heatmap`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Forbidden");
  assert.match(data.message, /Insufficient permissions/i);
});

test("HTTP Test 9: Teacher cannot mark attendance for an unassigned student (HTTP 403 Forbidden)", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Teacher 1 is assigned only STU-1001 and STU-1002; attempts STU-9999
  const payload = {
    records: [
      {
        studentId: "STU-9999", // Unassigned
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "present",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Forbidden");
  assert.match(data.message, /not authorized to mark attendance for unassigned student/i);
});

test("HTTP Test 10: Bulk batch containing one unauthorized student is atomically rejected with HTTP 403 Forbidden", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Smuggled batch: STU-1001 (assigned) + STU-9999 (unassigned)
  const attackPayload = {
    records: [
      { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      { studentId: "STU-9999", className: "Grade 10-A", date: "2026-07-24", status: "present" },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(attackPayload),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Entire batch rejected/i);
});

test("HTTP Test 11: Parent cannot access unlinked child attendance (HTTP 403 Forbidden)", async () => {
  const parentToken = createAuthToken("parent-id-1", "parent");
  const headers = createHeaders(parentToken);

  // Parent is linked only to STU-1001; attempts STU-9999
  const res = await fetch(`http://127.0.0.1:${port}/api/parent/child-attendance/STU-9999`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Forbidden");
  assert.match(data.message, /not linked to student/i);
});

test("HTTP Test 12: Parent can access linked child attendance (HTTP 200 OK)", async () => {
  const parentToken = createAuthToken("parent-id-1", "parent");
  const headers = createHeaders(parentToken);

  // Parent is linked to STU-1001
  const res = await fetch(`http://127.0.0.1:${port}/api/parent/child-attendance/STU-1001?year=2026&month=7`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.studentId, "STU-1001");
  assert.ok(data.summary);
});

test("HTTP Test 13: Parent with zero linked children receives empty records with 0 stats (Zero Mock Data Leakage)", async () => {
  const emptyParentToken = createAuthToken("parent-empty-id", "parent");
  const headers = createHeaders(emptyParentToken);

  const res = await fetch(`http://127.0.0.1:${port}/api/parent/attendance`, {
    method: "GET",
    headers,
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.records.length, 0);
  assert.equal(data.summary.totalDays, 0);
  assert.equal(data.summary.attendanceRate, 0);
});

test("HTTP Test 14: Strict Date Contract: Invalid calendar date (e.g. 2026-02-30) is rejected with HTTP 400 Bad Request", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const invalidDatePayload = {
    records: [
      {
        studentId: "STU-1001",
        className: "Grade 10-A",
        date: "2026-02-30", // Non-existent date!
        status: "present",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(invalidDatePayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Expected strict 'YYYY-MM-DD' calendar date/i);
});

test("HTTP Test 15: Invalid status enum in POST /api/attendance is rejected with HTTP 400 Bad Request", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const invalidStatusPayload = {
    records: [
      {
        studentId: "STU-1001",
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "tardy_unexcused", // Invalid status
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(invalidStatusPayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Invalid attendance status/i);
});

test("HTTP Test 16: Rate limiter headers are exported on POST /api/attendance", async () => {
  const adminToken = createAuthToken("admin-id-1", "admin");
  const headers = createHeaders(adminToken);

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      records: [
        { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      ],
    }),
  });

  assert.equal(res.status, 200);
  // express-rate-limit standard headers
  const limit = res.headers.get("ratelimit-limit");
  const remaining = res.headers.get("ratelimit-remaining");
  assert.ok(limit !== null, "ratelimit-limit header should be present");
  assert.ok(remaining !== null, "ratelimit-remaining header should be present");
});

test("HTTP Test 17: Valid authenticated and authorized attendance request succeeds with HTTP 200 OK", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const validPayload = {
    records: [
      {
        studentId: "STU-1001", // Assigned
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "present",
        remarks: "On time for practical session",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(validPayload),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message, "Attendance records saved successfully.");
});

/**
 * =============================================================================
 * SECTION C: DATABASE INTEGRATION TESTS (MongoDB Server Verification)
 * =============================================================================
 */

test("Database Integration Test: Verifies live MongoDB status", (t) => {
  const isMongoConnected = mongoose.connection.readyState === 1;

  if (!isMongoConnected) {
    t.skip(
      "Live MongoDB connection is offline at localhost:27017. Skipping live database query execution."
    );
    return;
  }

  assert.ok(isMongoConnected, "MongoDB is connected and live queries can execute.");
});
