/**
 * Email Service Module (Mock / Simulated Dispatcher for Development & Testing)
 *
 * NOTICE & LIMITATIONS:
 * - This is an explicitly SIMULATED email dispatcher for development and automated testing.
 * - NO real email delivery is performed, and no external SMTP server or email provider is connected.
 * - Credentials, raw reset tokens, and full reset URLs containing tokens are STRICTLY REDACTED
 *   from console logs and stdout to prevent token leakage in server logs.
 * - For automated testing, dispatched payloads are inspectable in-memory when NODE_ENV === 'test'.
 */

// In-memory test store for verifying dispatch behavior in test environments
const dispatchedEmailsTestStore = [];

/**
 * Format and safely log simulated email delivery without exposing raw secrets.
 */
function logSimulatedDispatch({ messageId, recipient, subject, emailType }) {
  // Never log raw tokens, passwords, or full reset URLs in application logs
  if (process.env.NODE_ENV !== "test") {
    console.log(`\n📧 [SIMULATED EMAIL DISPATCH - MOCK ONLY]`);
    console.log(`├─ Type:       ${emailType}`);
    console.log(`├─ Message ID: ${messageId}`);
    console.log(`├─ Recipient:  ${recipient}`);
    console.log(`├─ Subject:    ${subject}`);
    console.log(`├─ Token/Link: [REDACTED FOR SECURITY]`);
    console.log(`└─ Notice:     Simulated delivery only. No external email was dispatched.\n`);
  }
}

/**
 * Sends a password reset email notification (Mock / Simulated).
 *
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} [params.name] - Recipient name
 * @param {string} params.resetToken - Raw reset token (redacted in logs)
 * @param {string} [params.resetUrl] - Reset password URL (redacted in logs)
 * @returns {Promise<Object>} Mock dispatch confirmation
 */
async function sendPasswordResetEmail({ name, email, resetToken, resetUrl }) {
  if (!email || typeof email !== "string" || !email.trim()) {
    throw new Error("Recipient email address is required for password reset dispatch");
  }

  const timestamp = new Date().toISOString();
  const messageId = `mock_reset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const subject = "🔒 School Portal - Password Reset Request";
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const derivedResetUrl = resetUrl || `${frontendOrigin}/reset-password?token=${resetToken}`;

  // Log safe simulated audit line
  logSimulatedDispatch({
    messageId,
    recipient: email,
    subject,
    emailType: "PASSWORD_RESET",
  });

  const record = {
    messageId,
    simulated: true,
    delivered: false, // Explicitly false: mock dispatcher does not perform real-world delivery
    recipient: email,
    subject,
    sentAt: timestamp,
    meta: {
      type: "password_reset",
      name: name || "User",
      // Store in memory for testing inspection only
      tokenHashPrefix: resetToken ? resetToken.substring(0, 4) + "..." : null,
    },
    // Raw token and link kept ONLY in memory for testing verification
    _testPayload: {
      resetToken,
      resetUrl: derivedResetUrl,
    },
  };

  if (process.env.NODE_ENV === "test") {
    dispatchedEmailsTestStore.push(record);
  }

  return {
    success: true,
    simulated: true,
    delivered: false,
    messageId,
    recipient: email,
    sentAt: timestamp,
    notice: "Simulated email dispatch completed. No external email was sent.",
  };
}

/**
 * Sends welcome registration email containing login credentials (Mock / Simulated).
 */
async function sendRegistrationEmail({ name, email, role, password, userId, loginUrl }) {
  if (!email) throw new Error("Recipient email is required");

  const timestamp = new Date().toISOString();
  const messageId = `mock_reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const subject = `🎉 Welcome to School Portal - Account Registration (${(role || "user").toUpperCase()})`;

  logSimulatedDispatch({
    messageId,
    recipient: email,
    subject,
    emailType: "REGISTRATION_CREDENTIALS",
  });

  const record = {
    messageId,
    simulated: true,
    delivered: false,
    recipient: email,
    subject,
    sentAt: timestamp,
    meta: {
      type: "registration",
      name: name || "User",
      role: role || "user",
      userId,
    },
    _testPayload: {
      password,
      loginUrl,
    },
  };

  if (process.env.NODE_ENV === "test") {
    dispatchedEmailsTestStore.push(record);
  }

  return {
    success: true,
    simulated: true,
    delivered: false,
    messageId,
    recipient: email,
    sentAt: timestamp,
    notice: "Simulated registration email dispatch completed.",
  };
}

/**
 * Resends login credentials email (Mock / Simulated).
 */
async function resendCredentialsEmail({ name, email, role, password, userId }) {
  if (!email) throw new Error("Recipient email is required");

  const timestamp = new Date().toISOString();
  const messageId = `mock_resend_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const subject = "📩 School Portal - Credentials Reminder";

  logSimulatedDispatch({
    messageId,
    recipient: email,
    subject,
    emailType: "RESEND_CREDENTIALS",
  });

  return {
    success: true,
    simulated: true,
    delivered: false,
    messageId,
    recipient: email,
    sentAt: timestamp,
  };
}

/**
 * Test inspection helpers (available in test environments).
 */
function getDispatchedEmailsForTesting() {
  return [...dispatchedEmailsTestStore];
}

function clearDispatchedEmailsForTesting() {
  dispatchedEmailsTestStore.length = 0;
}

module.exports = {
  sendPasswordResetEmail,
  sendRegistrationEmail,
  resendCredentialsEmail,
  getDispatchedEmailsForTesting,
  clearDispatchedEmailsForTesting,
};
