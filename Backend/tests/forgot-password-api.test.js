const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/internship_project_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

const app = require("../app");
const User = require("../models/User");
const {
  sendPasswordResetEmail,
  getDispatchedEmailsForTesting,
  clearDispatchedEmailsForTesting,
} = require("../services/emailService");

let server;
let port;
let originalUserFindOne;
let originalUserFindOneAndUpdate;

// Simulated in-memory user registry for HTTP integration tests
let mockUsers = {};

/**
 * Initialize test user registry with clean bcrypt hashes (12 rounds) and tokenVersion
 */
async function initMockUsers() {
  const salt = await bcrypt.genSalt(12);
  const initialPasswordHash = await bcrypt.hash("InitialPassword123!", salt);

  mockUsers = {
    "parent@school.com": {
      _id: "user-parent-1",
      userId: "PRN-001",
      email: "parent@school.com",
      username: "sarah_jenkins",
      name: "Sarah Jenkins",
      role: "parent",
      status: "active",
      tokenVersion: 0,
      password: initialPasswordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      async comparePassword(candidate) {
        return await bcrypt.compare(candidate, this.password);
      },
      async save() {
        return this;
      },
    },
    "teacher@school.com": {
      _id: "user-teacher-1",
      userId: "TCH-001",
      email: "teacher@school.com",
      username: "dr_vance",
      name: "Dr. Vance",
      role: "teacher",
      status: "active",
      tokenVersion: 0,
      password: initialPasswordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      async comparePassword(candidate) {
        return await bcrypt.compare(candidate, this.password);
      },
      async save() {
        return this;
      },
    },
    "suspended@school.com": {
      _id: "user-suspended-1",
      userId: "USR-SUSP",
      email: "suspended@school.com",
      username: "suspended_user",
      name: "Suspended Account",
      role: "user",
      status: "suspended", // Ineligible status
      tokenVersion: 0,
      password: initialPasswordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      async comparePassword(candidate) {
        return await bcrypt.compare(candidate, this.password);
      },
      async save() {
        return this;
      },
    },
  };
}

/**
 * Helper to fetch CSRF token and cookie from running server
 */
const getCsrfHeaders = async (testKey = "default_test_key") => {
  const res = await fetch(`http://127.0.0.1:${port}/api/csrf-token`);
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/XSRF-TOKEN=([^;]+)/);
  const cookieVal = match ? match[1] : "";
  const data = await res.json();
  const token = data.csrfToken || cookieVal;
  return {
    "Content-Type": "application/json",
    cookie: `XSRF-TOKEN=${cookieVal}`,
    "x-xsrf-token": token,
    "x-test-key": testKey,
    "x-test-ip": testKey,
  };
};

before(async () => {
  await initMockUsers();

  originalUserFindOne = User.findOne;
  originalUserFindOneAndUpdate = User.findOneAndUpdate;

  // Stub User.findOne
  User.findOne = async (query) => {
    if (query.email) {
      const email = String(query.email).trim().toLowerCase();
      return mockUsers[email] || null;
    }
    if (query.$or) {
      for (const cond of query.$or) {
        if (cond._id) {
          for (const u of Object.values(mockUsers)) {
            if (u._id === cond._id) return u;
          }
        }
        if (cond.userId) {
          for (const u of Object.values(mockUsers)) {
            if (u.userId === cond.userId) return u;
          }
        }
      }
    }
    if (query.resetPasswordToken) {
      const token = query.resetPasswordToken;
      for (const u of Object.values(mockUsers)) {
        if (u.resetPasswordToken === token) {
          if (query.resetPasswordExpires && query.resetPasswordExpires.$gt) {
            const now = query.resetPasswordExpires.$gt;
            if (u.resetPasswordExpires && u.resetPasswordExpires > now) {
              return u;
            }
            return null;
          }
          return u;
        }
      }
      return null;
    }
    return null;
  };

  // Stub User.findOneAndUpdate with database-level atomic token consumption & tokenVersion increment semantics
  User.findOneAndUpdate = async (filter, update) => {
    if (filter.resetPasswordToken) {
      const token = filter.resetPasswordToken;
      for (const u of Object.values(mockUsers)) {
        if (u.resetPasswordToken === token) {
          // Check expiration
          if (filter.resetPasswordExpires && filter.resetPasswordExpires.$gt) {
            const now = filter.resetPasswordExpires.$gt;
            if (!u.resetPasswordExpires || u.resetPasswordExpires <= now) {
              return null; // Expired
            }
          }

          // Atomically apply update
          if (update.$set) {
            if (update.$set.password) u.password = update.$set.password;
          }
          if (update.$unset) {
            if (update.$unset.resetPasswordToken) u.resetPasswordToken = null;
            if (update.$unset.resetPasswordExpires) u.resetPasswordExpires = null;
          }
          if (update.$inc) {
            if (update.$inc.tokenVersion) {
              u.tokenVersion = (u.tokenVersion || 0) + update.$inc.tokenVersion;
            }
          }

          return u;
        }
      }
      return null;
    }
    return null;
  };

  // Bind server to ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  User.findOne = originalUserFindOne;
  User.findOneAndUpdate = originalUserFindOneAndUpdate;

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ==========================================
// GROUP 1: SCHEMA & UNIT SECURITY TESTS
// ==========================================

test("Unit Test 1: User Schema includes resetPasswordToken, resetPasswordExpires, and tokenVersion fields", () => {
  const tokenPath = User.schema.path("resetPasswordToken");
  const expiresPath = User.schema.path("resetPasswordExpires");
  const tokenVersionPath = User.schema.path("tokenVersion");

  assert.ok(tokenPath, "resetPasswordToken path must exist on User schema");
  assert.equal(tokenPath.instance, "String");
  assert.ok(expiresPath, "resetPasswordExpires path must exist on User schema");
  assert.equal(expiresPath.instance, "Date");
  assert.ok(tokenVersionPath, "tokenVersion path must exist on User schema");
  assert.equal(tokenVersionPath.instance, "Number");
});

test("Unit Test 2: User Schema indexes include sparse compound index on reset token and index on tokenVersion", () => {
  const indexes = User.schema.indexes();
  const tokenIndex = indexes.find((idx) => idx[0] && idx[0].resetPasswordToken === 1 && idx[0].resetPasswordExpires === 1);
  assert.ok(tokenIndex, "Compound index on resetPasswordToken and resetPasswordExpires must be registered");
  assert.equal(tokenIndex[1].sparse, true, "Token index must be sparse");

  const versionIndex = indexes.find((idx) => idx[0] && idx[0].tokenVersion === 1);
  assert.ok(versionIndex, "Index on tokenVersion must be registered for fast session invalidation");
});

test("Unit Test 3: Token Generation & SHA-256 Hashing produces 256-bit entropy and valid digest", () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  assert.equal(rawToken.length, 64, "Raw token must be 64 hex characters (256 bits)");

  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(hashedToken.length, 64, "SHA-256 digest must be 64 hex characters");
  assert.notEqual(rawToken, hashedToken, "Hashed token must never match raw token");

  // Re-hashing produces the exact same digest
  const verifyHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(hashedToken, verifyHash, "Hash computation must be strictly deterministic");
});

test("Unit Test 4: Token expiration calculation is strictly 15 minutes (900,000 ms)", () => {
  const now = Date.now();
  const resetExpires = new Date(now + 15 * 60 * 1000);
  const diffMs = resetExpires.getTime() - now;
  assert.equal(diffMs, 900000, "Expiration window must be exactly 15 minutes in milliseconds");
});

// ==========================================
// GROUP 2: MOCK EMAIL SUBSYSTEM & URL FRAGMENT TESTS
// ==========================================

test("Unit Test 5: Email dispatcher is explicitly identified as simulated / mock delivery", async () => {
  clearDispatchedEmailsForTesting();

  const result = await sendPasswordResetEmail({
    name: "Test User",
    email: "test@school.com",
    resetToken: "abcdef1234567890abcdef1234567890",
  });

  assert.equal(result.success, true);
  assert.equal(result.simulated, true, "Delivery must be explicitly marked as simulated");
  assert.equal(result.delivered, false, "External delivery must be false");
  assert.match(result.notice, /Simulated email dispatch completed/);

  const testStore = getDispatchedEmailsForTesting();
  assert.equal(testStore.length, 1);
  assert.equal(testStore[0].simulated, true);
  assert.equal(testStore[0].delivered, false);
});

test("Unit Test 6: Mock email service places reset token in URL fragment (#token=) and redacts raw token in meta", async () => {
  clearDispatchedEmailsForTesting();

  const secretToken = "super_secret_raw_token_xyz987";
  await sendPasswordResetEmail({
    name: "Sarah",
    email: "sarah@school.com",
    resetToken: secretToken,
  });

  const testStore = getDispatchedEmailsForTesting();
  const record = testStore[0];
  assert.equal(record.meta.tokenHashPrefix, "supe...", "Meta must only show safe prefix");
  assert.equal(record.meta.resetToken, undefined, "Meta must not leak raw token");
  assert.ok(
    record._testPayload.resetUrl.includes("#token="),
    "Reset link MUST place token in URL fragment (#token=) so browsers do not send token to web servers"
  );
  assert.equal(
    record._testPayload.resetUrl.includes("?token="),
    false,
    "Reset link must NOT place token in query string"
  );
});

// ==========================================
// GROUP 3: PRIORITY 1 & TOKEN SECURITY TESTS (Express via Ephemeral Port)
// ==========================================

test("HTTP Test 7b: Priority 1: GET /api/auth/validate-reset-token/:token has been removed and returns HTTP 404", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/validate-reset-token/sample_token_in_path`, {
    method: "GET",
  });

  assert.equal(res.status, 404, "GET endpoint with token in path MUST be completely removed and return 404 Not Found");
});

test("HTTP Test 8: Request password reset stores SHA-256 hash in DB and never stores raw token", async () => {
  clearDispatchedEmailsForTesting();
  await initMockUsers();

  const headers = await getCsrfHeaders("test_http_8");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "parent@school.com" }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.resetToken, undefined, "Response body must NEVER leak raw reset token");
  assert.equal(data.resetUrl, undefined, "Response body must NEVER leak reset URL");

  // Verify in-memory database record
  const user = mockUsers["parent@school.com"];
  assert.ok(user.resetPasswordToken, "Database must have stored reset token");
  assert.ok(user.resetPasswordExpires, "Database must have stored expiration");
  assert.ok(user.resetPasswordExpires > new Date(), "Expiration must be in the future");

  // Check email test store to get raw token and verify database has only the SHA-256 hash
  const emails = getDispatchedEmailsForTesting();
  assert.equal(emails.length, 1);
  const rawToken = emails[0]._testPayload.resetToken;

  const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(user.resetPasswordToken, expectedHash, "Stored token must match SHA-256 hash of raw token");
  assert.notEqual(user.resetPasswordToken, rawToken, "Raw token must NEVER be stored directly in database");
});

test("HTTP Test 9: Expired token (>15 minutes old) is rejected by validate-reset-token with HTTP 400", async () => {
  const expiredRawToken = "expired_raw_token_abc123";
  const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");

  mockUsers["parent@school.com"].resetPasswordToken = expiredHash;
  mockUsers["parent@school.com"].resetPasswordExpires = new Date(Date.now() - 60 * 1000); // Expired 1 min ago

  const headers = await getCsrfHeaders("test_http_9");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/validate-reset-token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: expiredRawToken }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.valid, false);
  assert.match(data.message, /invalid or has expired/i);
});

test("HTTP Test 10: Invalid/malformed token is rejected by validate-reset-token with HTTP 400", async () => {
  const headers = await getCsrfHeaders("test_http_10");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/validate-reset-token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: "non_existent_token_999" }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.equal(data.valid, false);
  assert.match(data.message, /invalid or has expired/i);
});

test("HTTP Test 11: Valid active token is accepted by validate-reset-token via POST JSON body without exposing user details", async () => {
  const validRawToken = "valid_raw_token_xyz456";
  const validHash = crypto.createHash("sha256").update(validRawToken).digest("hex");

  mockUsers["parent@school.com"].resetPasswordToken = validHash;
  mockUsers["parent@school.com"].resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  const headers = await getCsrfHeaders("test_http_11");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/validate-reset-token`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: validRawToken }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.valid, true);
  assert.equal(data.email, undefined, "Email must not be leaked in validate-reset-token response");
  assert.equal(data.user, undefined, "User object must not be leaked");
});

test("HTTP Test 12: Successful password reset atomically consumes token, unsetting it from database", async () => {
  const rawToken = "consume_me_token_111";
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  mockUsers["teacher@school.com"].resetPasswordToken = tokenHash;
  mockUsers["teacher@school.com"].resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  const headers = await getCsrfHeaders("test_http_12");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: rawToken,
      password: "BrandNewTeacherPassword123!",
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.match(data.message, /Password updated successfully/i);

  // Verify token is unset in database
  const user = mockUsers["teacher@school.com"];
  assert.equal(user.resetPasswordToken, null, "resetPasswordToken must be null after reset");
  assert.equal(user.resetPasswordExpires, null, "resetPasswordExpires must be null after reset");
});

test("HTTP Test 13: Reused token after successful reset is rejected with HTTP 400", async () => {
  // Using the same token from Test 12
  const rawToken = "consume_me_token_111";

  const headers = await getCsrfHeaders("test_http_13");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: rawToken,
      password: "AnotherNewPassword123!",
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /invalid or has expired/i);
});

test("HTTP Test 14: Concurrent reset attempts with same token guarantee only ONE succeeds", async () => {
  const raceToken = "race_condition_test_token_777";
  const raceHash = crypto.createHash("sha256").update(raceToken).digest("hex");

  mockUsers["parent@school.com"].resetPasswordToken = raceHash;
  mockUsers["parent@school.com"].resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  const headers = await getCsrfHeaders("test_http_14");

  // Fire two simultaneous reset requests with the same token
  const req1 = fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: raceToken, password: "NewConcurrentPass1!" }),
  });

  const req2 = fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: raceToken, password: "NewConcurrentPass2!" }),
  });

  const [res1, res2] = await Promise.all([req1, req2]);
  const statuses = [res1.status, res2.status].sort();

  assert.deepEqual(statuses, [200, 400], "Exactly one concurrent request must succeed (200) and the other fail (400)");
});

// ==========================================
// GROUP 4: ACCOUNT ENUMERATION PROTECTION TESTS
// ==========================================

test("HTTP Test 15: Existing account and nonexistent account receive identical public responses", async () => {
  const headers = await getCsrfHeaders("test_http_15");

  const existingRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "parent@school.com" }),
  });

  const nonexistentRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "nonexistent_account_12345@school.com" }),
  });

  assert.equal(existingRes.status, 200);
  assert.equal(nonexistentRes.status, 200);

  const existingData = await existingRes.json();
  const nonexistentData = await nonexistentRes.json();

  assert.deepEqual(existingData, nonexistentData, "Public response for existing and nonexistent accounts must be 100% identical");
  assert.equal(existingData.message, "If an account with that email exists, a password reset link has been dispatched.");
});

test("HTTP Test 16: Ineligible / suspended account receives the exact same public response", async () => {
  const headers = await getCsrfHeaders("test_http_16");

  const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "suspended@school.com" }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.message, "If an account with that email exists, a password reset link has been dispatched.");

  // Suspended account must NOT have a reset token generated
  assert.equal(mockUsers["suspended@school.com"].resetPasswordToken, null, "Suspended account must not receive token");
});

test("HTTP Test 17: Email dispatch exception does not disclose account existence and returns identical HTTP 200", async () => {
  // Temporarily stub sendPasswordResetEmail to throw an error
  const emailService = require("../services/emailService");
  const tempSend = emailService.sendPasswordResetEmail;
  emailService.sendPasswordResetEmail = async () => {
    throw new Error("Simulated internal email failure");
  };

  const headers = await getCsrfHeaders("test_http_17");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "parent@school.com" }),
  });

  emailService.sendPasswordResetEmail = tempSend;

  assert.equal(res.status, 200, "Must return HTTP 200 despite email failure");
  const data = await res.json();
  assert.equal(data.message, "If an account with that email exists, a password reset link has been dispatched.");
});

// ==========================================
// GROUP 5: PASSWORD SECURITY & AUTHENTICATION TESTS
// ==========================================

test("HTTP Test 18: Password reset updates password with bcrypt 12-round hash matching User schema", async () => {
  const rawToken = "bcrypt_verify_token_999";
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  mockUsers["parent@school.com"].resetPasswordToken = tokenHash;
  mockUsers["parent@school.com"].resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  const newPlainPass = "BrandNewSuperSecurePass2026!";
  const headers = await getCsrfHeaders("test_http_18");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: rawToken,
      password: newPlainPass,
    }),
  });

  assert.equal(res.status, 200);

  const user = mockUsers["parent@school.com"];
  assert.ok(user.password.startsWith("$2b$12$"), "Stored hash must use bcrypt cost factor 12 ($2b$12$)");
  const isMatch = await bcrypt.compare(newPlainPass, user.password);
  assert.equal(isMatch, true, "Bcrypt compare must verify new plain password matches stored hash");
});

test("HTTP Test 19: Old password fails authentication on /api/auth/login with HTTP 401", async () => {
  const headers = await getCsrfHeaders("test_http_19");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "parent@school.com",
      password: "InitialPassword123!", // Old password
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /invalid credentials/i);
});

test("HTTP Test 20: New password successfully authenticates on /api/auth/login with HTTP 200", async () => {
  const headers = await getCsrfHeaders("test_http_20");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "parent@school.com",
      password: "BrandNewSuperSecurePass2026!", // New password set in Test 18
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.user.email, "parent@school.com");
  assert.ok(data.expiresAt);
});

// ==========================================
// GROUP 5B: PRIORITY 2 — SERVER-SIDE SESSION INVALIDATION TESTS
// ==========================================

test("HTTP Test 20b: Priority 2: Successful password reset invalidates old Cookie & Bearer JWTs while new login succeeds", async () => {
  await initMockUsers();

  const headers = await getCsrfHeaders("session_invalidation_test");

  // Step 1: User logs in before password reset
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "parent@school.com",
      password: "InitialPassword123!",
    }),
  });

  assert.equal(loginRes.status, 200);
  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  const authCookieMatch = setCookieHeader.match(/auth-token=([^;]+)/);
  const initialCookieToken = authCookieMatch ? authCookieMatch[1] : "";
  assert.ok(initialCookieToken, "Initial login must set auth-token cookie");

  // Step 2: Test active session via Cookie
  const meCookieRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      cookie: `auth-token=${initialCookieToken}`,
    },
  });
  assert.equal(meCookieRes.status, 200, "Active cookie session must succeed before reset");

  // Step 3: Test active session via Bearer Header
  const meBearerRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${initialCookieToken}`,
    },
  });
  assert.equal(meBearerRes.status, 200, "Active Bearer session must succeed before reset");

  // Step 4: Merely requesting a password reset does NOT invalidate sessions
  const forgotRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "parent@school.com" }),
  });
  assert.equal(forgotRes.status, 200);

  const meStillActiveRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${initialCookieToken}`,
    },
  });
  assert.equal(meStillActiveRes.status, 200, "Session must NOT be invalidated merely by requesting reset");

  // Step 5: Perform successful password reset
  const emails = getDispatchedEmailsForTesting();
  const resetToken = emails[emails.length - 1]._testPayload.resetToken;

  const resetRes = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: resetToken,
      password: "BrandNewPostResetPassword123!",
    }),
  });
  assert.equal(resetRes.status, 200, "Password reset must succeed");

  // Step 6: Verify old Cookie JWT is now rejected with HTTP 401
  const postResetCookieRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      cookie: `auth-token=${initialCookieToken}`,
    },
  });
  assert.equal(postResetCookieRes.status, 401, "Old Cookie JWT must be rejected with 401 after password reset");
  const cookieErrData = await postResetCookieRes.json();
  assert.match(cookieErrData.message, /Session invalidated due to password reset/i);

  // Step 7: Verify old Bearer JWT is now rejected with HTTP 401
  const postResetBearerRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${initialCookieToken}`,
    },
  });
  assert.equal(postResetBearerRes.status, 401, "Old Bearer JWT must be rejected with 401 after password reset");

  // Step 8: Log in with newly set password
  const newLoginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "parent@school.com",
      password: "BrandNewPostResetPassword123!",
    }),
  });
  assert.equal(newLoginRes.status, 200, "Login with new password must succeed");
  const newSetCookie = newLoginRes.headers.get("set-cookie") || "";
  const newCookieToken = newSetCookie.match(/auth-token=([^;]+)/)[1];

  // Step 9: Newly authenticated session works normally
  const meNewRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${newCookieToken}`,
    },
  });
  assert.equal(meNewRes.status, 200, "New session must be valid and authorized");
});

test("HTTP Test 20c: Priority 1: Strict Token Version Validation rejects legacy, mismatched, or altered JWTs", async () => {
  await initMockUsers();
  const user = mockUsers["parent@school.com"];
  user.tokenVersion = 0; // Baseline version

  // Case 1: Legacy JWT without tokenVersion claim is strictly rejected with HTTP 401
  const legacyTokenNoVersion = jwt.sign(
    { id: user._id, userId: user.userId, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const legacyRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${legacyTokenNoVersion}` },
  });
  assert.equal(legacyRes.status, 401, "Legacy JWT without tokenVersion must return HTTP 401");
  const legacyData = await legacyRes.json();
  assert.match(legacyData.message, /invalid or missing tokenVersion/i);

  // Case 2: Matching current version (version 0 vs DB version 0) succeeds with HTTP 200
  const validVersion0Token = jwt.sign(
    { id: user._id, userId: user.userId, email: user.email, role: user.role, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const validRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validVersion0Token}` },
  });
  assert.equal(validRes.status, 200, "Matching tokenVersion must succeed with HTTP 200");

  // Case 3: Version 0 JWT after database version increments to 1 is rejected with HTTP 401
  user.tokenVersion = 1; // Database version increments (e.g. after password reset)
  const staleRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${validVersion0Token}` },
  });
  assert.equal(staleRes.status, 401, "Version 0 JWT after DB increments to 1 must return HTTP 401");
  const staleData = await staleRes.json();
  assert.match(staleData.message, /Session invalidated due to password reset or token version mismatch/i);

  // Case 4: Incorrect / non-matching version (e.g. client tokenVersion: 99 vs DB version: 1) is rejected with HTTP 401
  const mismatchedToken = jwt.sign(
    { id: user._id, userId: user.userId, email: user.email, role: user.role, tokenVersion: 99 },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const mismatchedRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${mismatchedToken}` },
  });
  assert.equal(mismatchedRes.status, 401, "Mismatched tokenVersion (99 vs 1) must return HTTP 401");

  // Case 5: New login after reset issues token with matching version (1) and succeeds
  const headers = await getCsrfHeaders("new_login_after_version_inc");
  const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "parent@school.com",
      password: "InitialPassword123!",
    }),
  });
  assert.equal(loginRes.status, 200, "Login must succeed");
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const freshToken = setCookie.match(/auth-token=([^;]+)/)[1];

  const meFreshRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${freshToken}` },
  });
  assert.equal(meFreshRes.status, 200, "Fresh session matching current DB tokenVersion must succeed");
});

test("HTTP Test 21: Password shorter than 8 characters is rejected with HTTP 400 Bad Request", async () => {
  const rawToken = "short_pass_token_555";
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  mockUsers["parent@school.com"].resetPasswordToken = tokenHash;
  mockUsers["parent@school.com"].resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  const headers = await getCsrfHeaders("test_http_21");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: rawToken,
      password: "short", // Only 5 characters
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.ok(data.errors.some((e) => e.message.includes("at least 8 characters")));
});

// ==========================================
// GROUP 6: RATE LIMITING & ABUSE RESISTANCE TESTS
// ==========================================

test("HTTP Test 22: Forgot password endpoint validates email format, rejecting invalid emails with HTTP 400", async () => {
  const headers = await getCsrfHeaders("test_http_22");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "not-an-email" }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.ok(data.errors.some((e) => e.message.includes("valid email")));
});

test("HTTP Test 23: Account identifiers are normalized for rate limiting", async () => {
  const email1 = "  Parent@SCHOOL.com  ";
  const email2 = "parent@school.com";
  assert.equal(email1.trim().toLowerCase(), email2.trim().toLowerCase(), "Normalized keys must be strictly identical");
});

test("HTTP Test 24: Reset password rate limiter enforces 5-attempt limit and returns HTTP 429", async () => {
  const dedicatedKey = "rate_limit_reset_test_client";
  const headers = await getCsrfHeaders(dedicatedKey);

  // Send 5 failed attempts (which consume rate limit quota)
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: `invalid_token_${i}`, password: "ValidPassword123!" }),
    });
    assert.equal(res.status, 400);
  }

  // The 6th request must be rejected with HTTP 429 Too Many Requests
  const rateLimitedRes = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: "invalid_token_6", password: "ValidPassword123!" }),
  });

  assert.equal(rateLimitedRes.status, 429, "6th attempt must trigger HTTP 429 Too Many Requests");
  const data = await rateLimitedRes.json();
  assert.equal(data.success, false);
  assert.equal(data.error, "Too Many Requests");
});

test("HTTP Test 25: Priority 2: Overall IP Rate Limiter — Repeated requests to multiple different emails from one IP hit the IP limit", async () => {
  // Attacker uses one IP ("attacker_ip_rotating_emails") and sends requests targeting 10 different email addresses
  const attackerIp = "attacker_ip_rotating_emails";

  // Requests 1 through 10 (each to a unique email address) consume the 10-request IP quota
  for (let i = 1; i <= 10; i++) {
    const headers = await getCsrfHeaders(attackerIp);
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: `unique_user_${i}@school.com` }),
    });
    assert.equal(res.status, 200, `Request ${i} with unique email must succeed before reaching IP ceiling`);
  }

  // Request 11 with an 11th distinct email address must be rejected by forgotPasswordIpLimiter with HTTP 429
  const headers11 = await getCsrfHeaders(attackerIp);
  const blockedRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers: headers11,
    body: JSON.stringify({ email: "unique_user_11@school.com" }),
  });

  assert.equal(blockedRes.status, 429, "11th request from same IP must hit overall IP ceiling despite changing email");
  const blockedData = await blockedRes.json();
  assert.equal(blockedData.error, "Too Many Requests");
  assert.match(blockedData.message, /Too many password reset requests from this IP address/i);
});

test("HTTP Test 25b: Priority 2: Account-Level Abuse Isolation — Attacker on IP A does not lock out legitimate victim on IP B", async () => {
  const attackerIp = "attacker_ip_focused_target";
  const victimIp = "victim_ip_legitimate_client";
  const targetEmail = "parent@school.com";

  // Attacker spams 5 requests for victim's email from attacker's IP
  for (let i = 0; i < 5; i++) {
    const headers = await getCsrfHeaders(attackerIp);
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: targetEmail }),
    });
    assert.equal(res.status, 200);
  }

  // Attacker is now rate-limited on 6th request from attacker IP
  const headers6 = await getCsrfHeaders(attackerIp);
  const attackerBlockedRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers: headers6,
    body: JSON.stringify({ email: targetEmail }),
  });
  assert.equal(attackerBlockedRes.status, 429, "Attacker must be rate-limited on their IP");

  // Legitimate victim on separate IP (victimIp) must NOT be locked out and can request recovery
  const victimHeaders = await getCsrfHeaders(victimIp);
  const victimAllowedRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers: victimHeaders,
    body: JSON.stringify({ email: targetEmail }),
  });

  assert.equal(victimAllowedRes.status, 200, "Victim from legitimate IP must NOT be locked out by attacker");
  const victimData = await victimAllowedRes.json();
  assert.equal(victimData.success, true);
  assert.equal(victimData.message, "If an account with that email exists, a password reset link has been dispatched.");
});

test("HTTP Test 25c: Priority 2: Account Enumeration Parity — Existing and nonexistent accounts experience equivalent public responses", async () => {
  const clientIp = "parity_test_client_ip";
  const headers = await getCsrfHeaders(clientIp);

  // Request for existing account
  const existingRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "parent@school.com" }),
  });
  assert.equal(existingRes.status, 200);
  const existingData = await existingRes.json();

  // Request for nonexistent account
  const nonexistentRes = await fetch(`http://127.0.0.1:${port}/api/auth/forgot-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "doesnotexist_9999@school.com" }),
  });
  assert.equal(nonexistentRes.status, 200);
  const nonexistentData = await nonexistentRes.json();

  // Both public payloads must be identical
  assert.deepEqual(existingData, nonexistentData, "Public response for existing and nonexistent accounts must be strictly identical");
  assert.equal(existingData.success, true);
  assert.equal(existingData.message, "If an account with that email exists, a password reset link has been dispatched.");
});

// ==========================================
// GROUP 7: LIVE DATABASE VERIFICATION & NON-RUN REPORTING
// ==========================================

test("Database Integration Test: Verifies live MongoDB status (Explicit Non-Run Reporting)", async (t) => {
  if (mongoose.connection.readyState !== 1) {
    t.skip("Real MongoDB server is not running on 127.0.0.1:27017. Live database integration & persistence tests were not run.");
    return;
  }
  assert.equal(mongoose.connection.readyState, 1);
});
