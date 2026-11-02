const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const { authorize } = require("../middleware/rbac");

const TEST_MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/internship_project_rbac_test";
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-use-env-vars";

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
});

after(async () => {
  await User.deleteMany({ email: /@test-rbac-domain\.com$/ });
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@test-rbac-domain\.com$/ });
});

// Helper to simulate Express req, res, next
const createMockReqRes = (headers = {}, cookies = {}) => {
  const req = {
    headers,
    cookies,
    method: "GET",
    url: "/api/protected-resource",
    ip: "127.0.0.1",
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  let nextCalled = false;
  let nextError = null;
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return { req, res, next, isNextCalled: () => nextCalled, getNextError: () => nextError };
};

test("1. Factory function throws TypeError when initialized with invalid parameters", () => {
  assert.throws(
    () => authorize(),
    (err) => {
      assert.equal(err.name, "TypeError");
      assert.match(err.message, /'requiredRoles' parameter is required/);
      return true;
    }
  );

  assert.throws(
    () => authorize(""),
    (err) => {
      assert.equal(err.name, "TypeError");
      assert.match(err.message, /must be a non-empty string or array of non-empty strings/);
      return true;
    }
  );

  assert.throws(
    () => authorize([]),
    (err) => {
      assert.equal(err.name, "TypeError");
      assert.match(err.message, /must be a non-empty string or array of non-empty strings/);
      return true;
    }
  );
});

test("2. Returns 401 Unauthorized when Authorization header and token are missing", async () => {
  const middleware = authorize("user");
  const { req, res, next, isNextCalled } = createMockReqRes();

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Missing authentication token/);
});

test("3. Returns 401 Unauthorized for malformed Authorization header", async () => {
  const middleware = authorize("user");
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: "Basic invalid_format_token",
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Invalid Authorization header format/);
});

test("4. Returns 401 Unauthorized for invalid JWT signature", async () => {
  const middleware = authorize("user");
  const invalidToken = jwt.sign({ id: new mongoose.Types.ObjectId() }, "wrong-secret-key");
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${invalidToken}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Invalid authentication token/);
});

test("5. Returns 401 Unauthorized for expired JWT token", async () => {
  const middleware = authorize("user");
  const expiredToken = jwt.sign(
    { id: new mongoose.Types.ObjectId() },
    JWT_SECRET,
    { expiresIn: "-1s" }
  );
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${expiredToken}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Authentication token has expired/);
});

test("6. Returns 404 Not Found when token user ID does not exist in database", async () => {
  const middleware = authorize("user");
  const nonExistentId = new mongoose.Types.ObjectId();
  const validToken = jwt.sign({ id: nonExistentId }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${validToken}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /User account does not exist/);
});

test("7. Returns 403 Forbidden when user account is inactive or suspended", async () => {
  const middleware = authorize("user");
  const suspendedUser = new User({
    email: "suspended@test-rbac-domain.com",
    password: "password123",
    role: "user",
    status: "suspended",
  });
  await suspendedUser.save();

  const token = jwt.sign({ id: suspendedUser._id }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${token}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Account is inactive or suspended/);
});

test("8. Returns 403 Forbidden when user role is insufficient for required role", async () => {
  const middleware = authorize("admin");
  const normalUser = new User({
    email: "regularuser@test-rbac-domain.com",
    password: "password123",
    role: "user",
    status: "active",
  });
  await normalUser.save();

  const token = jwt.sign({ id: normalUser._id }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${token}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Insufficient permissions/);
});

test("9. Grants access and attaches sanitized user object for matching single role", async () => {
  const middleware = authorize("user");
  const activeUser = new User({
    email: "activeuser@test-rbac-domain.com",
    password: "password123",
    role: "user",
    status: "active",
  });
  await activeUser.save();

  const token = jwt.sign({ id: activeUser._id }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${token}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), true);
  assert.notEqual(req.user, undefined);
  assert.equal(req.user.email, "activeuser@test-rbac-domain.com");
  assert.equal(req.user.role, "user");
  assert.equal(req.user.password, undefined); // Sanitized
  assert.equal(req.user.__v, undefined); // Sanitized
});

test("10. Grants access when middleware is initialized with array of allowed roles", async () => {
  const middleware = authorize(["admin", "moderator"]);
  const moderatorUser = new User({
    email: "moderator@test-rbac-domain.com",
    password: "password123",
    role: "moderator",
    status: "active",
  });
  await moderatorUser.save();

  const token = jwt.sign({ id: moderatorUser._id }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${token}`,
  });

  await middleware(req, res, next);

  assert.equal(isNextCalled(), true);
  assert.equal(req.user.role, "moderator");
});

test("11. Supports role hierarchy (Admin user accesses route requiring moderator or user role)", async () => {
  const middlewareForModerator = authorize("moderator");
  const adminUser = new User({
    email: "adminhierarchical@test-rbac-domain.com",
    password: "password123",
    role: "admin",
    status: "active",
  });
  await adminUser.save();

  const token = jwt.sign({ id: adminUser._id }, JWT_SECRET);
  const { req, res, next, isNextCalled } = createMockReqRes({
    authorization: `Bearer ${token}`,
  });

  await middlewareForModerator(req, res, next);

  assert.equal(isNextCalled(), true);
  assert.equal(req.user.role, "admin");
});
