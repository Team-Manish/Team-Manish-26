/**
 * Email Service Module (Mock / Stub for MVP)
 * Handles sending login details and credentials notification emails to new users upon registration.
 */

/**
 * Sends welcome registration email containing login credentials to newly created user accounts.
 *
 * @param {Object} params
 * @param {string} params.name - Full name of the user
 * @param {string} params.email - Recipient email address
 * @param {string} params.role - User role (teacher, parent, student, user, admin)
 * @param {string} params.password - Temporary or initial password
 * @param {string} params.userId - Assigned User ID
 * @param {string} [params.loginUrl] - Portal login URL
 * @returns {Promise<Object>} Status result of mock email dispatch
 */
async function sendRegistrationEmail({ name, email, role, password, userId, loginUrl }) {
  const portalUrl = loginUrl || process.env.FRONTEND_ORIGIN || "http://localhost:5173/login";
  const formattedRole = (role || "user").toUpperCase();
  const timestamp = new Date().toISOString();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const subject = `🎉 Welcome to School Portal - Account Registration & Credentials (${formattedRole})`;

  const textContent = `
===================================================================
SCHOOL PORTAL - NEW ACCOUNT CREATION & CREDENTIALS
===================================================================

Hello ${name || "User"},

An account has been created for you on the School Administration Portal by an administrator.

-------------------------------------------------------------------
ACCOUNT CREDENTIALS & LOGIN DETAILS:
-------------------------------------------------------------------
Full Name:          ${name || "N/A"}
Email Address:      ${email}
Assigned User ID:   ${userId || "N/A"}
Account Role:       ${formattedRole}
Temporary Password: ${password}
-------------------------------------------------------------------

PORTAL LOGIN URL:
${portalUrl}

SECURITY NOTICE:
Please log in to your account using the credentials above and update your password immediately upon first access.

Best regards,
School Administration Team
===================================================================
`;

  // Log clean mock dispatch audit to console for MVP verification
  console.log(`\n📧 [EMAIL SERVICE STUB / MOCK DISPATCH]`);
  console.log(`├─ Message ID: ${messageId}`);
  console.log(`├─ Recipient:  ${email}`);
  console.log(`├─ Subject:    ${subject}`);
  console.log(`├─ User ID:    ${userId}`);
  console.log(`├─ Role:       ${formattedRole}`);
  console.log(`└─ Sent At:    ${timestamp}\n`);

  return {
    success: true,
    stub: true,
    messageId,
    recipient: email,
    subject,
    sentAt: timestamp,
    details: {
      name,
      email,
      userId,
      role: role ? role.toLowerCase() : "user",
      loginUrl: portalUrl,
    },
    message: `Mock email credentials dispatched successfully to ${email}`,
  };
}

/**
 * Resends login credentials email to an existing user (Mock / Stub for MVP)
 */
async function resendCredentialsEmail({ name, email, role, password, userId }) {
  const timestamp = new Date().toISOString();
  const messageId = `resend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  console.log(`\n📩 [EMAIL SERVICE STUB - RESEND CREDENTIALS]`);
  console.log(`├─ Message ID: ${messageId}`);
  console.log(`├─ Recipient:  ${email}`);
  console.log(`├─ Sent At:    ${timestamp}\n`);

  return {
    success: true,
    stub: true,
    messageId,
    recipient: email,
    sentAt: timestamp,
    message: `Resent account credentials email to ${email}`,
  };
}

/**
 * Sends password reset email containing secure time-limited reset link to user (Mock / Stub for MVP).
 *
 * @param {Object} params
 * @param {string} params.name - User's name
 * @param {string} params.email - Recipient email
 * @param {string} params.resetToken - Secure hex token
 * @param {string} [params.resetUrl] - Reset password URL
 * @returns {Promise<Object>} Status payload of email dispatch
 */
async function sendPasswordResetEmail({ name, email, resetToken, resetUrl }) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const link = resetUrl || `${frontendOrigin}/reset-password?token=${resetToken}`;
  const timestamp = new Date().toISOString();
  const messageId = `reset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const subject = "🔒 Password Reset Request - School Portal";

  console.log(`\n🔑 [EMAIL SERVICE STUB - PASSWORD RESET LINK]`);
  console.log(`├─ Message ID: ${messageId}`);
  console.log(`├─ Recipient:  ${email}`);
  console.log(`├─ Reset Link: ${link}`);
  console.log(`└─ Sent At:    ${timestamp}\n`);

  return {
    success: true,
    stub: true,
    messageId,
    recipient: email,
    subject,
    resetLink: link,
    resetToken,
    sentAt: timestamp,
    message: `Password reset link email dispatched successfully to ${email}`,
  };
}

module.exports = {
  sendRegistrationEmail,
  resendCredentialsEmail,
  sendPasswordResetEmail,
};
