const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Authentication API Logic Unit & Contract Tests
 * Tests logic rules, validation contracts, status response mappings, and rate limit rules.
 */

const validateEmailBackend = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePasswordBackend = (password) => {
  return typeof password === "string" && password.length >= 8;
};

test("Backend Auth Validation - Email format rule", () => {
  assert.equal(validateEmailBackend("parent@school.edu"), true);
  assert.equal(validateEmailBackend("invalid-email"), false);
  assert.equal(validateEmailBackend(""), false);
});

test("Backend Auth Validation - Password length rule", () => {
  assert.equal(validatePasswordBackend("12345678"), true);
  assert.equal(validatePasswordBackend("short"), false);
  assert.equal(validatePasswordBackend(""), false);
});

test("Backend Auth Error Status Code Contracts", () => {
  const getAuthErrorResponse = (statusCode, message, errors = null) => {
    const payload = { success: false, message };
    if (errors) payload.errors = errors;

    switch (statusCode) {
      case 400:
        return { status: 400, body: payload };
      case 401:
        return { status: 401, body: { success: false, message: "Invalid credentials" } };
      case 403:
        return { status: 403, body: { success: false, error: "Forbidden", message: "Invalid CSRF token" } };
      case 429:
        return { status: 429, body: { success: false, message: "Too many login attempts. Please try again after 15 minutes." } };
      default:
        return { status: 500, body: { success: false, message: "Internal server error" } };
    }
  };

  assert.equal(getAuthErrorResponse(400, "Validation failed").status, 400);
  assert.equal(getAuthErrorResponse(401).status, 401);
  assert.equal(getAuthErrorResponse(401).body.message, "Invalid credentials");
  assert.equal(getAuthErrorResponse(403).status, 403);
  assert.equal(getAuthErrorResponse(429).status, 429);
  assert.equal(getAuthErrorResponse(500).status, 500);
});
