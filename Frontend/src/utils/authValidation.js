/**
 * Authentication validation utility module
 * Provides email regex format checks, password length rules, and structured form validation.
 */

// Standard RFC 5322 compliant email validation regex
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates email format
 * @param {string} email 
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validates password minimum length requirement
 * @param {string} password 
 * @returns {boolean}
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== "string") return false;
  return password.length >= MIN_PASSWORD_LENGTH;
};

/**
 * Validates login form fields and returns structured error messages
 * @param {string} email 
 * @param {string} password 
 * @returns {{ isValid: boolean, emailError: string, passwordError: string }}
 */
export const getFormValidationErrors = (email, password) => {
  let emailError = "";
  let passwordError = "";

  const trimmedEmail = (email || "").trim();

  if (!trimmedEmail) {
    emailError = "Email address is required.";
  } else if (!validateEmail(trimmedEmail)) {
    emailError = "Please enter a valid email address format (e.g. parent@example.com).";
  }

  if (!password) {
    passwordError = "Password is required.";
  } else if (!validatePassword(password)) {
    passwordError = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long (${password.length}/${MIN_PASSWORD_LENGTH}).`;
  }

  return {
    isValid: !emailError && !passwordError,
    emailError,
    passwordError,
  };
};
