const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config();

const app = require("../app");
const UserProgress = require("../models/UserProgress");

const rawUri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_user_progress_test";
const TEST_MONGO_URI = rawUri.replace(/\/[^/?]+(\?|$)/, "/internship_project_user_progress_test$1");

let server;
let port;

const getAuthHeaders = () => {
  const csrfToken = "test-csrf-user-progress-token";
  return {
    Cookie: `XSRF-TOKEN=${csrfToken}`,
    "x-xsrf-token": csrfToken,
    "Content-Type": "application/json",
  };
};

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  await UserProgress.init();
  server = app.listen(0);
  port = server.address().port;
});

after(async () => {
  if (server) server.close();
  await UserProgress.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await UserProgress.deleteMany({});
});

test("1. POST /api/progress: Creates new progress record and returns 201 Created", async () => {
  const payload = {
    userId: "USER-101",
    contentId: "COURSE-MOD-1",
    progressPercentage: 50,
    completionStatus: "in_progress",
    message: "Halfway through module 1",
    metadata: { attempt: 1 },
  };

  const res = await fetch(`http://localhost:${port}/api/progress`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message, "Progress record created successfully.");
  assert.equal(data.data.userId, "USER-101");
  assert.equal(data.data.contentId, "COURSE-MOD-1");
  assert.equal(data.data.progressPercentage, 50);
  assert.equal(data.data.completionStatus, "in_progress");
  assert.ok(data.data._id);
});

test("2. POST /api/progress: Accepts edge cases 0% and 100% progress percentage", async () => {
  // Test 0%
  const payloadZero = {
    userId: "USER-102",
    contentId: "COURSE-MOD-2",
    progressPercentage: 0,
    completionStatus: "not_started",
  };

  const resZero = await fetch(`http://localhost:${port}/api/progress`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payloadZero),
  });

  assert.equal(resZero.status, 201);
  const dataZero = await resZero.json();
  assert.equal(dataZero.data.progressPercentage, 0);

  // Test 100%
  const payloadHundred = {
    userId: "USER-103",
    contentId: "COURSE-MOD-3",
    progressPercentage: 100,
    completionStatus: "completed",
  };

  const resHundred = await fetch(`http://localhost:${port}/api/progress`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payloadHundred),
  });

  assert.equal(resHundred.status, 201);
  const dataHundred = await resHundred.json();
  assert.equal(dataHundred.data.progressPercentage, 100);
});

test("3. POST /api/progress: Rejects duplicate (userId, contentId) creation with 409 Conflict", async () => {
  const payload = {
    userId: "USER-104",
    contentId: "COURSE-MOD-4",
    progressPercentage: 25,
    completionStatus: "in_progress",
  };

  const resInitial = await fetch(`http://localhost:${port}/api/progress`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  assert.equal(resInitial.status, 201);

  // Duplicate POST attempt
  const resDuplicate = await fetch(`http://localhost:${port}/api/progress`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  assert.equal(resDuplicate.status, 409);
  const dataDuplicate = await resDuplicate.json();
  assert.equal(dataDuplicate.success, false);
  assert.equal(dataDuplicate.error, "Conflict");
  assert.match(dataDuplicate.message, /already exists/);
});

test("4. POST /api/progress: Rejects invalid payloads (missing fields, out-of-range %) with 400 Bad Request", async () => {
  const invalidPayloads = [
    { contentId: "C1", progressPercentage: 50, completionStatus: "in_progress" }, // missing userId
    { userId: "U1", progressPercentage: 50, completionStatus: "in_progress" }, // missing contentId
    { userId: "U1", contentId: "C1", progressPercentage: -5, completionStatus: "in_progress" }, // % < 0
    { userId: "U1", contentId: "C1", progressPercentage: 105, completionStatus: "in_progress" }, // % > 100
    { userId: "U1", contentId: "C1", progressPercentage: "invalid", completionStatus: "in_progress" }, // non-numeric %
    { userId: "U1", contentId: "C1", progressPercentage: 50, completionStatus: "invalid_status" }, // invalid enum
  ];

  for (const payload of invalidPayloads) {
    const res = await fetch(`http://localhost:${port}/api/progress`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, "Bad Request");
    assert.ok(data.message);
  }
});

test("5. PUT /api/progress: Updates existing progress record and returns 200 OK", async () => {
  // Create initial record
  const initial = new UserProgress({
    userId: "USER-105",
    contentId: "COURSE-MOD-5",
    progressPercentage: 10,
    completionStatus: "in_progress",
  });
  await initial.save();

  const updatePayload = {
    userId: "USER-105",
    contentId: "COURSE-MOD-5",
    progressPercentage: 75,
    completionStatus: "in_progress",
    message: "Almost completed quiz",
  };

  const res = await fetch(`http://localhost:${port}/api/progress`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updatePayload),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message, "Progress record updated successfully.");
  assert.equal(data.data.progressPercentage, 75);
  assert.equal(data.data.message, "Almost completed quiz");
});

test("6. PUT /api/progress/:userId/:contentId: Updates record via URL parameters", async () => {
  const initial = new UserProgress({
    userId: "USER-106",
    contentId: "COURSE-MOD-6",
    progressPercentage: 40,
    completionStatus: "in_progress",
  });
  await initial.save();

  const updatePayload = {
    progressPercentage: 100,
    completionStatus: "completed",
  };

  const res = await fetch(`http://localhost:${port}/api/progress/USER-106/COURSE-MOD-6`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updatePayload),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.progressPercentage, 100);
  assert.equal(data.data.completionStatus, "completed");
});

test("7. PUT /api/progress: Returns 404 Not Found when updating non-existent record", async () => {
  const updatePayload = {
    userId: "NON-EXISTENT-USER",
    contentId: "NON-EXISTENT-CONTENT",
    progressPercentage: 50,
    completionStatus: "in_progress",
  };

  const res = await fetch(`http://localhost:${port}/api/progress`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updatePayload),
  });

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Not Found");
  assert.match(data.message, /Progress record not found/);
});

test("8. PUT /api/progress: Rejects invalid update payload with 400 Bad Request", async () => {
  const initial = new UserProgress({
    userId: "USER-107",
    contentId: "COURSE-MOD-7",
    progressPercentage: 20,
    completionStatus: "in_progress",
  });
  await initial.save();

  const invalidUpdatePayload = {
    userId: "USER-107",
    contentId: "COURSE-MOD-7",
    progressPercentage: 200, // > 100
  };

  const res = await fetch(`http://localhost:${port}/api/progress`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(invalidUpdatePayload),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Bad Request");
});

test("9. Concurrent PUT Updates: Handles concurrent update operations maintaining data integrity", async () => {
  const initial = new UserProgress({
    userId: "USER-108",
    contentId: "COURSE-MOD-8",
    progressPercentage: 10,
    completionStatus: "in_progress",
  });
  await initial.save();

  const updates = [20, 40, 60, 80, 100].map((percentage) =>
    fetch(`http://localhost:${port}/api/progress`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: "USER-108",
        contentId: "COURSE-MOD-8",
        progressPercentage: percentage,
        completionStatus: percentage === 100 ? "completed" : "in_progress",
      }),
    })
  );

  const responses = await Promise.all(updates);

  for (const res of responses) {
    assert.equal(res.status, 200);
  }

  const finalRecord = await UserProgress.findOne({
    userId: "USER-108",
    contentId: "COURSE-MOD-8",
  });

  assert.ok(finalRecord);
  assert.ok([20, 40, 60, 80, 100].includes(finalRecord.progressPercentage));
});
