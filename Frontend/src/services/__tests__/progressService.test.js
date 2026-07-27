import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProgressData, sendProgressUpdate } from "../progressService.js";

test("1. Schema Validation: Accepts valid progress data objects", () => {
  const validData = {
    progressPercentage: 85,
    taskId: "TASK-101",
    statusIdentifier: "in_progress",
  };
  assert.equal(validateProgressData(validData), null);
});

test("2. Schema Validation: Rejects invalid or out-of-bounds progressPercentage", () => {
  assert.match(
    validateProgressData({ progressPercentage: -5, taskId: "TASK-101", statusIdentifier: "in_progress" }),
    /Must be a number between 0 and 100/
  );

  assert.match(
    validateProgressData({ progressPercentage: 105, taskId: "TASK-101", statusIdentifier: "in_progress" }),
    /Must be a number between 0 and 100/
  );

  assert.match(
    validateProgressData({ progressPercentage: "85", taskId: "TASK-101", statusIdentifier: "in_progress" }),
    /Must be a number between 0 and 100/
  );
});

test("3. Schema Validation: Rejects missing taskId or invalid statusIdentifier", () => {
  assert.match(
    validateProgressData({ progressPercentage: 50, taskId: "", statusIdentifier: "in_progress" }),
    /Invalid 'taskId'/
  );

  assert.match(
    validateProgressData({ progressPercentage: 50, taskId: "TASK-101", statusIdentifier: "invalid_status" }),
    /Invalid 'statusIdentifier'/
  );
});

test("4. Request Deduplication: Returns identical in-flight promise for duplicate concurrent calls", async () => {
  let callCount = 0;
  const mockCustomFetch = async () => {
    callCount++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "OK", data: { id: "1" } }),
    };
  };

  const payload = {
    progressPercentage: 75,
    taskId: "DEDUP-TASK-1",
    statusIdentifier: "in_progress",
  };

  // Trigger two concurrent calls with identical payload
  const promise1 = sendProgressUpdate(payload, { customFetch: mockCustomFetch });
  const promise2 = sendProgressUpdate(payload, { customFetch: mockCustomFetch });

  const [res1, res2] = await Promise.all([promise1, promise2]);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);
  assert.equal(callCount, 1, "customFetch should only be called once due to deduplication");
});

test("5. Exponential Backoff Retry: Retries transient 500 errors and succeeds", async () => {
  let fetchAttempts = 0;
  const retryLogs = [];

  const mockCustomFetch = async () => {
    fetchAttempts++;
    if (fetchAttempts < 3) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ success: false, message: "Service Temporarily Unavailable" }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: "Success after retries", data: { id: "2" } }),
    };
  };

  const payload = {
    progressPercentage: 90,
    taskId: "RETRY-TASK-2",
    statusIdentifier: "completed",
  };

  const res = await sendProgressUpdate(payload, {
    customFetch: mockCustomFetch,
    maxRetries: 3,
    initialDelayMs: 10, // Short delay for fast unit tests
    onRetry: (attempt, delayMs) => {
      retryLogs.push({ attempt, delayMs });
    },
  });

  assert.equal(res.success, true);
  assert.equal(fetchAttempts, 3);
  assert.equal(retryLogs.length, 2);
  assert.equal(retryLogs[0].attempt, 1);
  assert.equal(retryLogs[1].attempt, 2);
});

test("6. Non-retryable 400 Client Error: Fails immediately without retrying", async () => {
  let fetchAttempts = 0;

  const mockCustomFetch = async () => {
    fetchAttempts++;
    return {
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: "BadRequest", message: "Invalid payload parameters" }),
    };
  };

  const payload = {
    progressPercentage: 40,
    taskId: "CLIENT-ERR-TASK",
    statusIdentifier: "pending",
  };

  await assert.rejects(
    async () => {
      await sendProgressUpdate(payload, {
        customFetch: mockCustomFetch,
        maxRetries: 3,
        initialDelayMs: 10,
      });
    },
    (err) => {
      assert.equal(err.success, false);
      assert.equal(err.statusCode, 400);
      assert.equal(err.isRetryable, false);
      assert.equal(fetchAttempts, 1, "4xx client error should not trigger retries");
      return true;
    }
  );
});
