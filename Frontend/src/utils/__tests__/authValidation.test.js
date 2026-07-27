import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEmail,
  validatePassword,
  getFormValidationErrors,
} from "../authValidation.js";

test("validateEmail - Valid Email Formats", () => {
  assert.equal(validateEmail("parent@school.edu"), true);
  assert.equal(validateEmail("sarah.jenkins@gmail.com"), true);
  assert.equal(validateEmail("user+tag@domain.co.uk"), true);
  assert.equal(validateEmail("  parent@example.com  "), true);
});

test("validateEmail - Invalid Email Formats", () => {
  assert.equal(validateEmail(""), false);
  assert.equal(validateEmail(null), false);
  assert.equal(validateEmail(undefined), false);
  assert.equal(validateEmail("plainaddress"), false);
  assert.equal(validateEmail("@no-user.com"), false);
  assert.equal(validateEmail("user@.com"), false);
  assert.equal(validateEmail("user@domain"), false);
  assert.equal(validateEmail("user space@domain.com"), false);
});

test("validatePassword - Length Enforcement", () => {
  assert.equal(validatePassword("1234567"), false);
  assert.equal(validatePassword("short"), false);
  assert.equal(validatePassword(""), false);
  assert.equal(validatePassword(null), false);
  assert.equal(validatePassword("12345678"), true);
  assert.equal(validatePassword("StrongPassword123!"), true);
});

test("getFormValidationErrors - Structured Error Output", () => {
  // Empty inputs
  const emptyRes = getFormValidationErrors("", "");
  assert.equal(emptyRes.isValid, false);
  assert.equal(emptyRes.emailError, "Email address is required.");
  assert.equal(emptyRes.passwordError, "Password is required.");

  // Invalid email format & short password
  const invalidRes = getFormValidationErrors("bad-email", "123");
  assert.equal(invalidRes.isValid, false);
  assert.match(invalidRes.emailError, /valid email address format/);
  assert.match(invalidRes.passwordError, /at least 8 characters/);

  // Valid credentials
  const validRes = getFormValidationErrors("parent@school.edu", "Password123!");
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.emailError, "");
  assert.equal(validRes.passwordError, "");
});
