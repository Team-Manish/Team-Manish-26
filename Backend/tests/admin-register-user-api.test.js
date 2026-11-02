const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * Backend Admin User Registration API Logic & Contract Unit Tests
 * Tests acceptance criteria for Admin User Creation (Teacher / Parent / Student),
 * Duplicate Email Validation, Admin Access Control, and Response Payload Contracts.
 */

// Simulated database collection state for unit testing
const mockUserDb = [
  { id: "usr_1", name: "Existing Teacher", email: "existing.teacher@school.com", role: "teacher" },
  { id: "usr_2", name: "Existing Parent", email: "existing.parent@school.com", role: "parent" },
];

const processAdminUserRegistration = ({ requesterRole, name, email, role, password, department, linkedStudentIds }) => {
  // 1. RBAC Guard: Only admins can access registration
  if (!requesterRole || requesterRole !== "admin") {
    return {
      status: 403,
      body: {
        success: false,
        error: "Forbidden",
        message: "Only administrators can access the registration form.",
      },
    };
  }

  // 2. Input validation
  const errors = [];
  if (!name || !name.trim()) errors.push("Name is required");
  if (!email || !email.trim() || !/^\S+@\S+\.\S+$/.test(email)) errors.push("Please enter a valid email address");
  if (!role || !["teacher", "parent", "student", "user"].includes(role)) errors.push("Invalid role selected");
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters long");

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: errors.join(", "),
        errors,
      },
    };
  }

  // 3. Duplicate email check
  const normEmail = email.trim().toLowerCase();
  const duplicate = mockUserDb.find((u) => u.email.toLowerCase() === normEmail);
  if (duplicate) {
    return {
      status: 400,
      body: {
        success: false,
        message: `Email address '${email}' is already registered`,
      },
    };
  }

  // 4. Create user record
  const newUser = {
    id: `usr_${Date.now()}`,
    userId: `${role.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    username: normEmail.split("@")[0],
    email: normEmail,
    name: name.trim(),
    role,
    ...(role === "teacher" && { department: department || "General Academics" }),
    ...(role === "parent" && { linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [] }),
  };

  mockUserDb.push(newUser);

  return {
    status: 201,
    body: {
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully by administrator`,
      user: newUser,
    },
  };
};

test("1. Admin User Registration: Admins can register new teacher or parent accounts with name, email, role, and password", () => {
  const resultTeacher = processAdminUserRegistration({
    requesterRole: "admin",
    name: "Dr. Sarah Connor",
    email: "sarah.connor@school.com",
    role: "teacher",
    password: "StrongPassword123!",
    department: "Advanced Mathematics",
  });

  assert.equal(resultTeacher.status, 201);
  assert.equal(resultTeacher.body.success, true);
  assert.equal(resultTeacher.body.user.name, "Dr. Sarah Connor");
  assert.equal(resultTeacher.body.user.email, "sarah.connor@school.com");
  assert.equal(resultTeacher.body.user.role, "teacher");
  assert.equal(resultTeacher.body.user.department, "Advanced Mathematics");

  const resultParent = processAdminUserRegistration({
    requesterRole: "admin",
    name: "Thomas Wayne",
    email: "thomas.wayne@school.com",
    role: "parent",
    password: "ParentPassword123!",
    linkedStudentIds: ["STU-1001"],
  });

  assert.equal(resultParent.status, 201);
  assert.equal(resultParent.body.success, true);
  assert.equal(resultParent.body.user.role, "parent");
  assert.deepEqual(resultParent.body.user.linkedStudentIds, ["STU-1001"]);
});

test("2. Duplicate Email Prevention: Rejects registration when email is already registered", () => {
  const duplicateAttempt = processAdminUserRegistration({
    requesterRole: "admin",
    name: "Duplicate User",
    email: "existing.teacher@school.com",
    role: "teacher",
    password: "Password123!",
  });

  assert.equal(duplicateAttempt.status, 400);
  assert.equal(duplicateAttempt.body.success, false);
  assert.match(duplicateAttempt.body.message, /Email address .* is already registered/);
});

test("3. Access Control: Non-admin users are strictly blocked from accessing registration", () => {
  const teacherAttempt = processAdminUserRegistration({
    requesterRole: "teacher",
    name: "Unauthorized Creation",
    email: "unauth@school.com",
    role: "parent",
    password: "Password123!",
  });

  assert.equal(teacherAttempt.status, 403);
  assert.equal(teacherAttempt.body.success, false);
  assert.match(teacherAttempt.body.message, /Only administrators can access the registration form/);

  const parentAttempt = processAdminUserRegistration({
    requesterRole: "parent",
    name: "Unauthorized Creation",
    email: "unauth2@school.com",
    role: "teacher",
    password: "Password123!",
  });

  assert.equal(parentAttempt.status, 403);
  assert.equal(parentAttempt.body.success, false);
});

test("4. Input Validation: Rejects invalid or missing parameters", () => {
  const invalidPass = processAdminUserRegistration({
    requesterRole: "admin",
    name: "John Smith",
    email: "john.smith@school.com",
    role: "teacher",
    password: "short",
  });

  assert.equal(invalidPass.status, 400);
  assert.match(invalidPass.body.message, /Password must be at least 8 characters long/);
});
