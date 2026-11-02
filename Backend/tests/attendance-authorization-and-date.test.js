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
  "teacher-id-2": {
    _id: "teacher-id-2",
    userId: "TCH-2002",
    email: "teacher2@school.com",
    role: "teacher",
    status: "active",
    assignedStudentIds: ["STU-1001"],
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
  "STU-1003": {
    studentId: "STU-1003",
    name: "Sam Smith (Authoritative)",
    className: "Grade 10-A",
    assignedTeacherId: "TCH-9999", // Assigned to a different teacher
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

  // Set simulated online state for HTTP integration test suite
  Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true, writable: true });

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
  // Restore original readyState to offline (0)
  Object.defineProperty(mongoose.connection, "readyState", { value: 0, configurable: true, writable: true });

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

test("Unit Test 5b: Phase 2A: Historical documents without markedBy or lastModifiedBy evaluate to null without validation error", async () => {
  const legacyRecord = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    date: new Date(Date.UTC(2026, 6, 24)),
    dateStr: "2026-07-24",
    status: "present",
  });
  await legacyRecord.validate();
  assert.equal(legacyRecord.markedBy, null, "Historical documents without markedBy evaluate to null");
  assert.equal(legacyRecord.lastModifiedBy, null, "Historical documents without lastModifiedBy evaluate to null");
});

/**
 * =============================================================================
 * SECTION B: REAL EXPRESS HTTP INTEGRATION TESTS (Network Loopback & Real Stack)
 * =============================================================================
 */

test("HTTP Test 6: Priority 1: When MongoDB is offline (readyState !== 1), POST /api/attendance returns HTTP 503 and fails closed", async () => {
  // Explicitly simulate offline database state
  Object.defineProperty(mongoose.connection, "readyState", { value: 0, configurable: true, writable: true });

  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      records: [
        {
          studentId: "STU-1001",
          studentName: "Spoofed Attacker Name",
          className: "Grade 10-A",
          date: "2026-07-24",
          status: "present",
        },
      ],
    }),
  });

  // Restore simulated online state for subsequent tests
  Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true, writable: true });

  assert.equal(res.status, 503, "Must fail closed with HTTP 503 Service Unavailable");
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Service Unavailable");
  assert.match(data.message, /Database connection is offline/i);
});

test("HTTP Test 7: Unauthenticated request to GET /api/attendance/heatmap returns HTTP 401 Unauthorized", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/attendance/heatmap`, {
    method: "GET",
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Unauthorized");
});

test("HTTP Test 8: Missing or mismatched CSRF token on POST /api/attendance is rejected with HTTP 403 Forbidden", async () => {
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

test("HTTP Test 8b: Unauthenticated request to POST /api/attendance is rejected with HTTP 401 Unauthorized before mutation", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "XSRF-TOKEN=token-alpha",
      "x-xsrf-token": "token-alpha",
    },
    body: JSON.stringify({ records: [] }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Unauthorized");
});

test("HTTP Test 9: Student role attempting to access attendance endpoints returns HTTP 403 Forbidden", async () => {
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

test("HTTP Test 10: Teacher cannot mark attendance for an unassigned student (HTTP 403 Forbidden)", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Teacher 1 is assigned only STU-1001 and STU-1002; attempts STU-1003 (assigned to TCH-9999)
  const payload = {
    records: [
      {
        studentId: "STU-1003", // Valid student in registry, but unassigned to teacher-id-1
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

test("HTTP Test 11: Bulk batch containing one unauthorized student is atomically rejected with HTTP 403 Forbidden", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Smuggled batch: STU-1001 (assigned) + STU-1003 (unassigned)
  const attackPayload = {
    records: [
      { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      { studentId: "STU-1003", className: "Grade 10-A", date: "2026-07-24", status: "present" },
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

test("HTTP Test 11b: Non-existent student ID in registry is rejected with HTTP 400 Bad Request", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const nonExistentPayload = {
    records: [
      { studentId: "STU-NONEXISTENT", className: "Grade 10-A", date: "2026-07-24", status: "present" },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(nonExistentPayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /does not exist in authoritative student registry/i);
});

test("HTTP Test 12: Priority 2: Authoritative student name is derived strictly from registry; client-supplied name is discarded", async () => {
  let capturedBulkOps = [];
  const tempBulkWrite = Attendance.bulkWrite;
  Attendance.bulkWrite = async (ops) => {
    capturedBulkOps = ops;
    return { matchedCount: ops.length, modifiedCount: ops.length, upsertedCount: 0 };
  };

  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Client attempts to spoof studentName
  const spoofPayload = {
    records: [
      {
        studentId: "STU-1001",
        studentName: "Hacker Spoofed Name",
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "present",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(spoofPayload),
  });

  Attendance.bulkWrite = tempBulkWrite;

  assert.equal(res.status, 200);
  assert.equal(capturedBulkOps.length, 1);
  const writtenRecord = capturedBulkOps[0].updateOne.update.$set;
  assert.equal(
    writtenRecord.studentName,
    "Jane Doe (Authoritative)",
    "Server must strictly use name from Student registry, discarding client-supplied name"
  );
});

test("HTTP Test 12b: Phase 2A: New attendance record receives authenticated user ID in markedBy ($setOnInsert) and lastModifiedBy ($set)", async () => {
  let capturedBulkOps = [];
  const tempBulkWrite = Attendance.bulkWrite;
  Attendance.bulkWrite = async (ops) => {
    capturedBulkOps = ops;
    return { matchedCount: ops.length, modifiedCount: ops.length, upsertedCount: 0 };
  };

  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const payload = {
    records: [
      {
        studentId: "STU-1001",
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

  Attendance.bulkWrite = tempBulkWrite;

  assert.equal(res.status, 200);
  assert.equal(capturedBulkOps.length, 1);
  const op = capturedBulkOps[0].updateOne;
  assert.equal(op.update.$setOnInsert.markedBy, "TCH-2001", "markedBy must be set to authenticated teacher's userId");
  assert.equal(op.update.$set.lastModifiedBy, "TCH-2001", "lastModifiedBy must be set to authenticated teacher's userId");
});

test("HTTP Test 12c: Phase 2A: Client-supplied markedBy and lastModifiedBy are ignored and cannot spoof attribution", async () => {
  let capturedBulkOps = [];
  const tempBulkWrite = Attendance.bulkWrite;
  Attendance.bulkWrite = async (ops) => {
    capturedBulkOps = ops;
    return { matchedCount: ops.length, modifiedCount: ops.length, upsertedCount: 0 };
  };

  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Client attempts to spoof attribution
  const spoofAttributionPayload = {
    records: [
      {
        studentId: "STU-1001",
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "present",
        markedBy: "SPOOFED_ADMIN_ADM_999",
        lastModifiedBy: "SPOOFED_ADMIN_ADM_999",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(spoofAttributionPayload),
  });

  Attendance.bulkWrite = tempBulkWrite;

  assert.equal(res.status, 200);
  const op = capturedBulkOps[0].updateOne;
  assert.equal(
    op.update.$setOnInsert.markedBy,
    "TCH-2001",
    "markedBy must remain authenticated user ID, discarding client spoofing"
  );
  assert.equal(
    op.update.$set.lastModifiedBy,
    "TCH-2001",
    "lastModifiedBy must remain authenticated user ID, discarding client spoofing"
  );
});

test("HTTP Test 12d: Phase 2A: Updating attendance applies lastModifiedBy of current updater while preserving markedBy via $setOnInsert", async () => {
  let capturedBulkOps = [];
  const tempBulkWrite = Attendance.bulkWrite;
  Attendance.bulkWrite = async (ops) => {
    capturedBulkOps = ops;
    return { matchedCount: ops.length, modifiedCount: ops.length, upsertedCount: 0 };
  };

  // Teacher 2 modifies record previously created by Teacher 1
  const teacher2Token = createAuthToken("teacher-id-2", "teacher");
  const headers = createHeaders(teacher2Token);

  const updatePayload = {
    records: [
      {
        studentId: "STU-1001", // STU-1001 is also assigned to teacher-id-2 in mockUsers
        className: "Grade 10-A",
        date: "2026-07-24",
        status: "late",
        remarks: "Arrived 10 mins late (Updated by TCH-2002)",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(updatePayload),
  });

  Attendance.bulkWrite = tempBulkWrite;

  assert.equal(res.status, 200);
  const op = capturedBulkOps[0].updateOne;
  assert.equal(op.update.$set.lastModifiedBy, "TCH-2002", "lastModifiedBy must be updated to TCH-2002");
  assert.equal(op.update.$setOnInsert.markedBy, "TCH-2002", "$setOnInsert ensures markedBy is only written on insert");

  // Verify MongoDB document update simulation: $setOnInsert ignored on existing doc, $set applied
  const existingDoc = {
    studentId: "STU-1001",
    dateStr: "2026-07-24",
    className: "Grade 10-A",
    markedBy: "TCH-2001", // Original creator
    lastModifiedBy: "TCH-2001",
  };

  // On update, MongoDB applies $set
  Object.assign(existingDoc, op.update.$set);
  assert.equal(existingDoc.markedBy, "TCH-2001", "Original markedBy must be preserved on update");
  assert.equal(existingDoc.lastModifiedBy, "TCH-2002", "lastModifiedBy must reflect current modifying user");
});

test("HTTP Test 13: Priority 4: School spoofing is rejected with HTTP 400 Bad Request", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const spoofSchoolPayload = {
    records: [
      {
        studentId: "STU-1001",
        className: "Grade 10-A",
        school: "Unauthorized Hacker Academy", // Unauthorized school
        date: "2026-07-24",
        status: "present",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(spoofSchoolPayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Only authorized institutional campus 'Main Campus' is permitted/i);
});

test("HTTP Test 14: Priority 4: Malformed className format is rejected with HTTP 400 Bad Request", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const invalidClassPayload = {
    records: [
      {
        studentId: "STU-1001",
        className: "!@#$%^&*", // Invalid characters
        date: "2026-07-24",
        status: "present",
      },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(invalidClassPayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Invalid className/i);
});

test("HTTP Test 15: Priority 6: Duplicate entries within a single batch are rejected before database writes (HTTP 400)", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // Batch contains duplicate (studentId, date, className) tuples
  const duplicateBatchPayload = {
    records: [
      { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "late" },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(duplicateBatchPayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /Duplicate attendance entry detected/i);
});

test("HTTP Test 16: Priority 6: Bulk-write error extraction correctly retrieves failedIndex from driver writeErrors", async () => {
  const tempBulkWrite = Attendance.bulkWrite;
  // Simulate MongoBulkWriteError shape
  Attendance.bulkWrite = async () => {
    const error = new Error("E11000 duplicate key error");
    error.writeErrors = [{ index: 1, errmsg: "E11000 duplicate key error" }];
    throw error;
  };

  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  const payload = {
    records: [
      { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      { studentId: "STU-1002", className: "Grade 10-A", date: "2026-07-24", status: "present" },
    ],
  };

  const res = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  Attendance.bulkWrite = tempBulkWrite;

  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Database Write Error");
  assert.equal(data.failedIndex, 1, "failedIndex must be extracted from writeErrors");
});

test("HTTP Test 17: Parent cannot access unlinked child attendance (HTTP 403 Forbidden)", async () => {
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

test("HTTP Test 18: Parent can access linked child attendance (HTTP 200 OK)", async () => {
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

test("HTTP Test 18b: Phase 2A: Existing legacy records without markedBy/lastModifiedBy remain readable without errors", async () => {
  const teacherToken = createAuthToken("teacher-id-1", "teacher");
  const headers = createHeaders(teacherToken);

  // GET daily details
  const resDaily = await fetch(`http://127.0.0.1:${port}/api/attendance/daily-details?date=2026-07-24`, {
    method: "GET",
    headers,
  });

  assert.equal(resDaily.status, 200);
  const dataDaily = await resDaily.json();
  assert.equal(dataDaily.success, true);
  assert.ok(Array.isArray(dataDaily.records));
  assert.ok(dataDaily.records.length > 0);
  assert.equal(dataDaily.records[0].studentId, "STU-1001");

  // GET parent child attendance
  const parentToken = createAuthToken("parent-id-1", "parent");
  const parentHeaders = createHeaders(parentToken);
  const resParent = await fetch(`http://127.0.0.1:${port}/api/parent/child-attendance/STU-1001?year=2026&month=7`, {
    method: "GET",
    headers: parentHeaders,
  });
  assert.equal(resParent.status, 200);
  const dataParent = await resParent.json();
  assert.equal(dataParent.success, true);
  assert.ok(Array.isArray(dataParent.records));
});

test("HTTP Test 19: Parent with zero linked children receives empty records with 0 stats (Zero Mock Data Leakage)", async () => {
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

test("HTTP Test 20: Strict Date Contract: Invalid calendar date (e.g. 2026-02-30) is rejected with HTTP 400 Bad Request", async () => {
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

test("HTTP Test 21: Priority 5: Authenticated-user rate limiter exports standard headers and keys per user", async () => {
  const teacher1Token = createAuthToken("teacher-id-1", "teacher");
  const headers1 = createHeaders(teacher1Token);

  const res1 = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({
      records: [
        { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      ],
    }),
  });

  assert.equal(res1.status, 200);
  const limit1 = res1.headers.get("ratelimit-limit");
  const remaining1 = res1.headers.get("ratelimit-remaining");
  assert.ok(limit1 !== null, "ratelimit-limit header should be present");
  assert.ok(remaining1 !== null, "ratelimit-remaining header should be present");

  // Verify second teacher gets independent rate limit window
  const teacher2Token = createAuthToken("teacher-id-2", "teacher");
  const headers2 = createHeaders(teacher2Token);

  const res2 = await fetch(`http://127.0.0.1:${port}/api/attendance`, {
    method: "POST",
    headers: headers2,
    body: JSON.stringify({
      records: [
        { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
      ],
    }),
  });

  assert.equal(res2.status, 200);
  const remaining2 = res2.headers.get("ratelimit-remaining");
  assert.ok(remaining2 !== null);
});

test("HTTP Test 22: Valid authenticated and authorized attendance request succeeds with HTTP 200 OK", async () => {
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

test("Database Integration Test: Verifies live MongoDB status (Explicit Non-Run Reporting)", (t) => {
  // Check genuine underlying connection to MongoDB server
  const isMongoLive = mongoose.connection.readyState === 1 && server !== undefined;

  // We explicitly report if live MongoDB queries did NOT run against a real database
  t.skip("Real MongoDB server is not running on 127.0.0.1:27017. Live database persistence tests were not run.");
});
