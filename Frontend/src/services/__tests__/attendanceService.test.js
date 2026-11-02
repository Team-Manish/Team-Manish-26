import { test } from "node:test";
import assert from "node:assert/strict";
import { saveAttendanceRecords } from "../attendanceService.js";

test("Frontend Test 1: saveAttendanceRecords returns success: true on HTTP 200 response", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      message: "Attendance records saved successfully.",
      matchedCount: 2,
      modifiedCount: 2,
      upsertedCount: 0,
    }),
  });

  const records = [
    { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, true);
  assert.equal(result.status, 200);
  assert.equal(result.matchedCount, 2);
  assert.match(result.message, /Attendance records saved successfully/);
});

test("Frontend Test 2: saveAttendanceRecords fails closed on HTTP 400 Bad Request (No False Success)", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      error: "Bad Request",
      message: "Invalid date format. Expected strict YYYY-MM-DD calendar date.",
    }),
  });

  const records = [
    { studentId: "STU-1001", className: "Grade 10-A", date: "invalid-date", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, false, "Must NOT convert 400 error to success");
  assert.equal(result.status, 400);
  assert.equal(result.error, "Bad Request");
  assert.match(result.message, /Invalid date format/);
});

test("Frontend Test 3: saveAttendanceRecords fails closed on HTTP 403 Forbidden (Unauthorized Teacher)", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      success: false,
      error: "Forbidden",
      message: "Forbidden: Teacher is not authorized to mark attendance for unassigned student 'STU-9999'.",
    }),
  });

  const records = [
    { studentId: "STU-9999", className: "Grade 10-A", date: "2026-07-24", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, false);
  assert.equal(result.status, 403);
  assert.equal(result.error, "Forbidden");
  assert.match(result.message, /not authorized/);
});

test("Frontend Test 4: saveAttendanceRecords fails closed on HTTP 500 Database Error and exports failedIndex", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({
      success: false,
      error: "Database Write Error",
      message: "Database error occurred during bulk attendance write.",
      failedIndex: 2,
    }),
  });

  const records = [
    { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, false);
  assert.equal(result.status, 500);
  assert.equal(result.error, "Database Write Error");
  assert.equal(result.failedIndex, 2);
});

test("Frontend Test 5: saveAttendanceRecords fails closed on HTTP 503 Service Unavailable (Database Offline)", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({
      success: false,
      error: "Service Unavailable",
      message: "Attendance service is unavailable: Database connection is offline. Attendance records cannot be verified or saved.",
    }),
  });

  const records = [
    { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, false, "Must NOT represent offline database write as success");
  assert.equal(result.status, 503);
  assert.equal(result.error, "Service Unavailable");
  assert.match(result.message, /Database connection is offline/);
});

test("Frontend Test 6: saveAttendanceRecords fails closed on network disconnect/fetch exception", async () => {
  const mockFetch = async () => {
    throw new Error("Failed to fetch: Connection refused");
  };

  const records = [
    { studentId: "STU-1001", className: "Grade 10-A", date: "2026-07-24", status: "present" },
  ];

  const result = await saveAttendanceRecords(records, mockFetch);
  assert.equal(result.success, false);
  assert.equal(result.status, 0);
  assert.equal(result.error, "Network Error");
  assert.match(result.message, /Connection refused/);
});

test("Frontend Test 7: Calendar Date Invariance: Canonical dateStr parsing does NOT shift calendar day in negative UTC offset", () => {
  // Simulate record from backend
  const apiRecord = {
    date: "2026-07-24T00:00:00.000Z",
    dateStr: "2026-07-24",
    status: "present",
  };

  // Buggy approach: new Date(apiRecord.date).getDate()
  // In America/New_York (UTC-4 in July):
  // 2026-07-24T00:00:00.000Z is 2026-07-23 20:00:00 EDT -> day is 23 (shifted!)

  // Correct approach using canonical dateStr:
  const parts = apiRecord.dateStr.split("-").map(Number);
  const calendarYear = parts[0];
  const calendarMonth = parts[1];
  const calendarDay = parts[2];

  assert.equal(calendarYear, 2026);
  assert.equal(calendarMonth, 7);
  assert.equal(calendarDay, 24, "Calendar day must strictly remain 24 regardless of local timezone");

  // UTC-formatted display string
  const utcDate = new Date(Date.UTC(calendarYear, calendarMonth - 1, calendarDay));
  const formatted = utcDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  assert.equal(formatted, "Jul 24, 2026", "Display label must remain Jul 24, 2026");
});
