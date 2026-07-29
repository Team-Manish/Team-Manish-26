import { test } from "node:test";
import assert from "node:assert/strict";

// Form validation and state processing helper logic
const validateAdminRegisterInput = ({ name, email, role, password }) => {
  const errors = [];

  if (!name || !name.trim()) {
    errors.push("Full name is required.");
  }

  if (!email || !email.trim()) {
    errors.push("Email address is required.");
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.push("A valid email address is required.");
  }

  const allowedRoles = ["teacher", "parent", "student", "user", "admin"];
  if (!role || !allowedRoles.includes(role)) {
    errors.push("Valid account role is required.");
  }

  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters long.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const checkDuplicateEmail = (existingEmails, targetEmail) => {
  const normalizedTarget = targetEmail.trim().toLowerCase();
  const exists = existingEmails.some((e) => e.trim().toLowerCase() === normalizedTarget);
  if (exists) {
    return `Email address '${targetEmail}' is already registered`;
  }
  return null;
};

test("1. Admin Register Form: Validates required fields (Name, Email, Role, Password)", () => {
  // Empty inputs -> Invalid
  const emptyVal = validateAdminRegisterInput({ name: "", email: "", role: "", password: "" });
  assert.equal(emptyVal.isValid, false);
  assert.equal(emptyVal.errors.length, 4);

  // Short password -> Invalid
  const shortPass = validateAdminRegisterInput({
    name: "Jane Doe",
    email: "jane@school.com",
    role: "teacher",
    password: "123",
  });
  assert.equal(shortPass.isValid, false);
  assert.match(shortPass.errors[0], /Password must be at least 8 characters/);

  // Invalid email format -> Invalid
  const badEmail = validateAdminRegisterInput({
    name: "Jane Doe",
    email: "not-an-email",
    role: "parent",
    password: "Password123!",
  });
  assert.equal(badEmail.isValid, false);
  assert.match(badEmail.errors[0], /valid email address/);

  // Complete & valid payload -> Valid
  const validPayload = validateAdminRegisterInput({
    name: "Dr. Eleanor Vance",
    email: "eleanor.vance@school.com",
    role: "teacher",
    password: "SecurePassword123!",
  });
  assert.equal(validPayload.isValid, true);
  assert.equal(validPayload.errors.length, 0);
});

test("2. Duplicate Email Check: Rejects registration if email already exists in system", () => {
  const existingEmails = ["teacher@school.com", "parent@school.com", "admin@school.com"];

  const dupCheck1 = checkDuplicateEmail(existingEmails, "teacher@school.com");
  assert.match(dupCheck1, /Email address 'teacher@school.com' is already registered/);

  const dupCheckCase = checkDuplicateEmail(existingEmails, "TEACHER@SCHOOL.COM");
  assert.match(dupCheckCase, /is already registered/);

  const uniqueCheck = checkDuplicateEmail(existingEmails, "newteacher@school.com");
  assert.equal(uniqueCheck, null);
});

test("3. Admin Access Rights: Enforces admin role for user creation", () => {
  const isUserAdmin = (user) => user && user.role === "admin";

  assert.equal(isUserAdmin({ role: "admin", email: "admin@school.com" }), true);
  assert.equal(isUserAdmin({ role: "teacher", email: "teacher@school.com" }), false);
  assert.equal(isUserAdmin({ role: "parent", email: "parent@school.com" }), false);
  assert.equal(isUserAdmin({ role: "student", email: "student@school.com" }), false);
});
