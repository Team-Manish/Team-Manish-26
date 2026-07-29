const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

/**
 * Backend Password Reset API Unit & Contract Tests
 * Tests acceptance criteria for Forgot Password flow:
 * 1. User requests password reset email.
 * 2. Backend generates time-limited secure token and stores in DB.
 * 3. User validates reset token & submits new password.
 * 4. Password updated (hashed with bcrypt), reset token cleared, update confirmed.
 */

// Simulated user database collection
const mockUserDb = [
  {
    id: "usr_1",
    email: "parent@school.com",
    name: "Sarah Jenkins",
    role: "parent",
    passwordHash: "$2b$12$eImiTXuWVxfM37uY4JANjO5E/8nJb2.z5eJj2cM2lY6v1b...", // Mock hashed pass
    resetPasswordToken: null,
    resetPasswordExpires: null,
  },
  {
    id: "usr_2",
    email: "teacher@school.com",
    name: "Dr. Eleanor Vance",
    role: "teacher",
    passwordHash: "$2b$12$eImiTXuWVxfM37uY4JANjO5E/8nJb2.z5eJj2cM2lY6v1b...",
    resetPasswordToken: "valid_active_token_123",
    resetPasswordExpires: new Date(Date.now() + 3600000), // Valid for 1 hour
  },
  {
    id: "usr_3",
    email: "student@school.com",
    name: "Alex Rivera",
    role: "student",
    passwordHash: "$2b$12$eImiTXuWVxfM37uY4JANjO5E/8nJb2.z5eJj2cM2lY6v1b...",
    resetPasswordToken: "expired_token_999",
    resetPasswordExpires: new Date(Date.now() - 3600000), // Expired 1 hour ago
  },
];

// Helper: Process Forgot Password Request (Task 1 & Task 2)
const processForgotPasswordRequest = (email) => {
  if (!email || !email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
    return {
      status: 400,
      body: { success: false, message: "Please enter a valid email address" },
    };
  }

  const normEmail = email.trim().toLowerCase();
  const user = mockUserDb.find((u) => u.email.toLowerCase() === normEmail);

  if (!user) {
    return {
      status: 200,
      body: {
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      },
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 3600000); // 1 hour

  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = resetExpires;

  return {
    status: 200,
    body: {
      success: true,
      message: "Password reset link has been dispatched to your email address.",
      resetToken,
      resetExpires,
      emailNotification: {
        status: "sent",
        recipient: user.email,
        stubMessage: "Email with reset link dispatched successfully (Mock MVP)",
      },
    },
  };
};

// Helper: Validate Reset Token (Task 3)
const validateResetTokenHelper = (token) => {
  if (!token) {
    return { status: 400, body: { success: false, valid: false, message: "Reset token is required" } };
  }

  const user = mockUserDb.find(
    (u) => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > new Date()
  );

  if (!user) {
    return {
      status: 400,
      body: { success: false, valid: false, message: "Password reset link is invalid or has expired." },
    };
  }

  return {
    status: 200,
    body: { success: true, valid: true, email: user.email, message: "Reset token is valid." },
  };
};

// Helper: Process Reset Password (Task 3 & Task 4)
const processResetPassword = async (token, newPassword) => {
  if (!token) {
    return { status: 400, body: { success: false, message: "Reset token is required" } };
  }
  if (!newPassword || newPassword.length < 8) {
    return { status: 400, body: { success: false, message: "New password must be at least 8 characters long" } };
  }

  const user = mockUserDb.find(
    (u) => u.resetPasswordToken === token && u.resetPasswordExpires && u.resetPasswordExpires > new Date()
  );

  if (!user) {
    return {
      status: 400,
      body: { success: false, message: "Password reset token is invalid or has expired." },
    };
  }

  // Hash new password using bcrypt
  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);

  // Clear reset token fields from DB
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  return {
    status: 200,
    body: {
      success: true,
      message: "Password updated successfully! You can now log in with your new password.",
    },
  };
};

test("1. Forgot Password Request: Generates time-limited token & stores in database", () => {
  const result = processForgotPasswordRequest("parent@school.com");
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.resetToken);
  assert.equal(typeof result.body.resetToken, "string");
  assert.ok(result.body.resetToken.length >= 32);

  const targetUser = mockUserDb.find((u) => u.email === "parent@school.com");
  assert.equal(targetUser.resetPasswordToken, result.body.resetToken);
  assert.ok(targetUser.resetPasswordExpires > new Date());
});

test("2. Input Validation: Rejects missing or malformed email address", () => {
  const invalidEmail = processForgotPasswordRequest("not-an-email");
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.body.success, false);
  assert.match(invalidEmail.body.message, /valid email address/);
});

test("3. Reset Token Validation: Accepts valid tokens and rejects expired/invalid tokens", () => {
  // Valid token
  const validRes = validateResetTokenHelper("valid_active_token_123");
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.valid, true);
  assert.equal(validRes.body.email, "teacher@school.com");

  // Expired token
  const expiredRes = validateResetTokenHelper("expired_token_999");
  assert.equal(expiredRes.status, 400);
  assert.equal(expiredRes.body.valid, false);
  assert.match(expiredRes.body.message, /invalid or has expired/);

  // Non-existent token
  const nonExistent = validateResetTokenHelper("unknown_token_abc");
  assert.equal(nonExistent.status, 400);
  assert.equal(nonExistent.body.valid, false);
});

test("4. Password Reset & Update: Hashes new password with bcrypt and clears reset token", async () => {
  const newPass = "NewStrongPassword123!";
  const resetRes = await processResetPassword("valid_active_token_123", newPass);

  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);
  assert.match(resetRes.body.message, /Password updated successfully/);

  const updatedUser = mockUserDb.find((u) => u.email === "teacher@school.com");
  // Token cleared in DB
  assert.equal(updatedUser.resetPasswordToken, null);
  assert.equal(updatedUser.resetPasswordExpires, null);

  // Verify new password bcrypt hash
  const isMatch = await bcrypt.compare(newPass, updatedUser.passwordHash);
  assert.equal(isMatch, true);
});
