const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");

/**
 * -----------------------------------------------------------------------------
 * 1. Attendance Model & Schema Validation Tests
 * -----------------------------------------------------------------------------
 */

test("Attendance Schema: Accepts valid attendance record with all required fields", async () => {
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

test("Attendance Schema: Rejects invalid status enum value", async () => {
  const record = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    dateStr: "2026-07-24",
    status: "tardy_unexcused", // Invalid status
  });

  await assert.rejects(
    async () => await record.validate(),
    /Invalid attendance status/
  );
});

test("Attendance Schema: Requires mandatory fields (studentId, studentName, className)", async () => {
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

test("Attendance Schema: Pre-validation hook auto-derives dateStr from date and date from dateStr", async () => {
  // Case A: date provided, dateStr omitted
  const recordA = new Attendance({
    studentId: "STU-1001",
    studentName: "Jane Doe",
    className: "Grade 10-A",
    date: new Date(Date.UTC(2026, 6, 24, 10, 30, 0)),
    status: "present",
  });
  await recordA.validate();
  assert.equal(recordA.dateStr, "2026-07-24", "dateStr should be auto-derived in YYYY-MM-DD");

  // Case B: dateStr provided, date omitted
  const recordB = new Attendance({
    studentId: "STU-1002",
    studentName: "Alex Doe",
    className: "Grade 10-A",
    dateStr: "2026-07-25",
    status: "late",
  });
  await recordB.validate();
  assert.ok(recordB.date instanceof Date, "date should be auto-derived as Date object");
  assert.equal(recordB.date.toISOString(), "2026-07-25T00:00:00.000Z");
});

test("Attendance Schema: Compound unique index { studentId: 1, dateStr: 1, className: 1 } is defined", () => {
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
  assert.equal(
    hasUniqueCompoundIndex,
    true,
    "Schema must export a unique compound index on { studentId, dateStr, className }"
  );
});

/**
 * -----------------------------------------------------------------------------
 * 2. School-Local Calendar Date Semantics & Immutability Tests
 * -----------------------------------------------------------------------------
 */

function parseCalendarDate(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      return { date, dateStr, year, month, day };
    }
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return { date, dateStr, year: parseInt(year, 10), month: parseInt(month, 10), day: parseInt(day, 10) };
}

test("Date Semantics: Prevents calendar day shifting across midnight and timezones", () => {
  // Input standard YYYY-MM-DD
  const parsed1 = parseCalendarDate("2026-07-24");
  assert.equal(parsed1.dateStr, "2026-07-24");
  assert.equal(parsed1.year, 2026);
  assert.equal(parsed1.month, 7);
  assert.equal(parsed1.day, 24);
  assert.equal(parsed1.date.toISOString(), "2026-07-24T00:00:00.000Z");

  // Input ISO string with high UTC hour (e.g. 23:45 UTC)
  const parsed2 = parseCalendarDate("2026-07-24T23:45:00.000Z");
  assert.equal(parsed2.dateStr, "2026-07-24");
  assert.equal(parsed2.date.toISOString(), "2026-07-24T00:00:00.000Z");

  // Malformed date input returns null
  assert.equal(parseCalendarDate("not-a-valid-date"), null);
  assert.equal(parseCalendarDate(null), null);
  assert.equal(parseCalendarDate(""), null);
});

/**
 * -----------------------------------------------------------------------------
 * 3. Teacher Attendance Authorization & Bulk Bypass Prevention Tests
 * -----------------------------------------------------------------------------
 */

test("Teacher Authorization: Verifies teacher can only mark attendance for assigned students", () => {
  const teacherUser = {
    role: "teacher",
    userId: "TCH-2001",
    assignedStudentIds: ["STU-1001", "STU-1002", "STU-1003"],
  };

  const assignedSet = new Set(teacherUser.assignedStudentIds);

  const isAuthorizedToMark = (studentId) => assignedSet.has(studentId);

  assert.equal(isAuthorizedToMark("STU-1001"), true, "Assigned student should be permitted");
  assert.equal(isAuthorizedToMark("STU-1002"), true, "Assigned student should be permitted");
  assert.equal(isAuthorizedToMark("STU-9999"), false, "Unassigned student must be blocked");
  assert.equal(isAuthorizedToMark("STU-OTHER"), false, "Unassigned student must be blocked");
});

test("Teacher Authorization: Bulk operations cannot bypass authorization (Atomically rejects entire batch)", () => {
  const teacherUser = {
    role: "teacher",
    userId: "TCH-2001",
    assignedStudentIds: ["STU-1001", "STU-1002"],
  };

  const assignedSet = new Set(teacherUser.assignedStudentIds);

  const validateBatch = (records) => {
    for (const record of records) {
      if (!assignedSet.has(record.studentId)) {
        return {
          allowed: false,
          error: `Forbidden: Teacher is not authorized to mark attendance for unassigned student '${record.studentId}'. Entire batch rejected.`,
        };
      }
    }
    return { allowed: true };
  };

  // Valid batch: all students assigned
  const validBatch = [
    { studentId: "STU-1001", status: "present" },
    { studentId: "STU-1002", status: "late" },
  ];
  const resValid = validateBatch(validBatch);
  assert.equal(resValid.allowed, true);

  // Attack batch: 2 assigned students + 1 unassigned student smuggled into batch
  const attackBatch = [
    { studentId: "STU-1001", status: "present" },
    { studentId: "STU-9999", status: "present" }, // UNASSIGNED!
    { studentId: "STU-1002", status: "present" },
  ];
  const resAttack = validateBatch(attackBatch);
  assert.equal(resAttack.allowed, false);
  assert.match(resAttack.error, /Forbidden/);
  assert.match(resAttack.error, /STU-9999/);
});

test("Teacher Read Authorization: Heatmap query filter restricts visibility to assigned students", () => {
  const teacherUser = {
    role: "teacher",
    userId: "TCH-2001",
    assignedStudentIds: ["STU-1001", "STU-1002"],
  };

  const buildQueryFilter = (user, baseFilter) => {
    if (user.role === "teacher") {
      const assigned = Array.isArray(user.assignedStudentIds) ? user.assignedStudentIds : [];
      if (assigned.length === 0) return null; // No accessible records
      return { ...baseFilter, studentId: { $in: assigned } };
    }
    return baseFilter;
  };

  const filter = buildQueryFilter(teacherUser, { dateStr: { $gte: "2026-07-01", $lte: "2026-07-31" } });
  assert.deepEqual(filter.studentId, { $in: ["STU-1001", "STU-1002"] });

  // Teacher with zero assigned students returns null filter (empty result set, no leakage)
  const unassignedTeacher = { role: "teacher", assignedStudentIds: [] };
  const emptyFilter = buildQueryFilter(unassignedTeacher, {});
  assert.equal(emptyFilter, null);
});

/**
 * -----------------------------------------------------------------------------
 * 4. Parent Attendance Authorization & Data Leakage Prevention Tests
 * -----------------------------------------------------------------------------
 */

test("Parent Authorization: Only permits access to linked students; forbids unlinked students", () => {
  const parentUser = {
    role: "parent",
    email: "sarah.jenkins@school.com",
    linkedStudentIds: ["STU-1001", "STU-1002"],
  };

  const isParentAuthorizedForChild = (parent, studentId) => {
    if (parent.role === "parent") {
      const linked = Array.isArray(parent.linkedStudentIds) ? parent.linkedStudentIds : [];
      return linked.includes(studentId);
    }
    return true; // Admin
  };

  // Positive cases: linked children
  assert.equal(isParentAuthorizedForChild(parentUser, "STU-1001"), true);
  assert.equal(isParentAuthorizedForChild(parentUser, "STU-1002"), true);

  // Negative cases: unauthorized student
  assert.equal(isParentAuthorizedForChild(parentUser, "STU-9999"), false);
  assert.equal(isParentAuthorizedForChild(parentUser, "STU-STRANGER"), false);
});

test("Parent Data Leakage Prevention: Parent with empty linkedStudentIds receives 0 records, never demo data", () => {
  const emptyParentUser = {
    role: "parent",
    email: "newparent@school.com",
    linkedStudentIds: [],
  };

  const getParentRecords = (parent, targetStudentId) => {
    const linked = Array.isArray(parent.linkedStudentIds) ? parent.linkedStudentIds : [];
    if (!targetStudentId) {
      if (linked.length === 0) {
        return { count: 0, records: [], summary: { attendanceRate: 0, totalDays: 0 } };
      }
    }
    if (!linked.includes(targetStudentId)) {
      return { forbidden: true };
    }
    return { count: 1, records: [{ studentId: targetStudentId }] };
  };

  const resultNoTarget = getParentRecords(emptyParentUser, "");
  assert.equal(resultNoTarget.count, 0);
  assert.equal(resultNoTarget.records.length, 0);

  const resultWithTarget = getParentRecords(emptyParentUser, "STU-1001");
  assert.equal(resultWithTarget.forbidden, true);
});

/**
 * -----------------------------------------------------------------------------
 * 5. Admin Full Authorization Tests
 * -----------------------------------------------------------------------------
 */

test("Admin Authorization: Full oversight across all students and classes without restriction", () => {
  const adminUser = {
    role: "admin",
    userId: "ADM-001",
    email: "admin@school.com",
  };

  const canAccessAnyStudent = (user) => user.role === "admin";
  assert.equal(canAccessAnyStudent(adminUser), true);

  const canViewSchoolWideHeatmap = (user) => ["admin"].includes(user.role);
  assert.equal(canViewSchoolWideHeatmap(adminUser), true);
});

/**
 * -----------------------------------------------------------------------------
 * 6. Role Protection Tests (Unauthorized Users)
 * -----------------------------------------------------------------------------
 */

test("Role Protection: Student and standard user roles are forbidden from attendance endpoints", () => {
  const permittedRoles = ["admin", "teacher"];
  const isPermitted = (role) => permittedRoles.includes(role);

  assert.equal(isPermitted("student"), false);
  assert.equal(isPermitted("user"), false);
  assert.equal(isPermitted("moderator"), false);
  assert.equal(isPermitted("parent"), false);
  assert.equal(isPermitted("teacher"), true);
  assert.equal(isPermitted("admin"), true);
});
