import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { validateEmail, validatePassword, getFormValidationErrors } from "../utils/authValidation";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Field interaction / touched states for real-time inline validation
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Failure counter for suggesting password reset upon repeated authentication failures
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Error states
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const abortControllerRef = useRef(null);
  const generalErrorRef = useRef(null);
  const emailInputRef = useRef(null);

  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading, error: authError } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  // Handle errors coming from AuthContext
  useEffect(() => {
    if (authError) {
      setGeneralError(authError);
    }
  }, [authError]);

  // Focus error summary for screen readers when general error appears
  useEffect(() => {
    if (generalError && generalErrorRef.current) {
      generalErrorRef.current.focus();
    }
  }, [generalError]);

  // Real-time inline email validation as user types
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (generalError) setGeneralError("");

    if (emailTouched || val.length > 3) {
      setEmailTouched(true);
      if (!val.trim()) {
        setEmailError("Email address is required.");
      } else if (!validateEmail(val)) {
        setEmailError("Please enter a valid email address format (e.g. parent@example.com).");
      } else {
        setEmailError("");
      }
    }
  };

  // Real-time inline password validation as user types
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);

    if (generalError) setGeneralError("");

    if (passwordTouched || val.length > 0) {
      setPasswordTouched(true);
      if (!val) {
        setPasswordError("Password is required.");
      } else if (!validatePassword(val)) {
        setPasswordError(`Password must be at least 8 characters long (${val.length}/8).`);
      } else {
        setPasswordError("");
      }
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (!email.trim()) {
      setEmailError("Email address is required.");
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address format (e.g. parent@example.com).");
    } else {
      setEmailError("");
    }
  };

  const handlePasswordBlur = () => {
    setPasswordTouched(true);
    if (!password) {
      setPasswordError("Password is required.");
    } else if (!validatePassword(password)) {
      setPasswordError(`Password must be at least 8 characters long (${password.length}/8).`);
    } else {
      setPasswordError("");
    }
  };

  // Quick preset helper for easy manual testing
  const handleFillDemo = (type = "success") => {
    setGeneralError("");
    setEmailTouched(true);
    setPasswordTouched(true);

    if (type === "success") {
      setEmail("sarah.jenkins@parentportal.org");
      setPassword("ParentPass2026!");
      setEmailError("");
      setPasswordError("");
    } else if (type === "invalid_auth") {
      setEmail("invalid@parent.com");
      setPassword("WrongPassword123");
      setEmailError("");
      setPasswordError("");
    } else if (type === "short_pwd") {
      setEmail("parent@example.com");
      setPassword("123");
      setEmailError("");
      setPasswordError("Password must be at least 8 characters long (3/8).");
    } else if (type === "bad_email") {
      setEmail("invalid-email-address");
      setPassword("ParentPass2026!");
      setEmailError("Please enter a valid email address format (e.g. parent@example.com).");
      setPasswordError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setGeneralError("");

    // Validate form inputs
    const { isValid, emailError: eErr, passwordError: pErr } = getFormValidationErrors(email, password);
    setEmailError(eErr);
    setPasswordError(pErr);

    if (!isValid) {
      if (eErr) emailInputRef.current?.focus();
      return;
    }

    // Cancel existing pending request if present
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsSubmitting(true);

    const attemptedPassword = password;
    // Clear password input immediately after capturing for security
    setPassword("");

    try {
      await login(email, attemptedPassword, abortControllerRef.current.signal);
      setFailedAttempts(0);
      navigate("/dashboard");
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      setFailedAttempts((prev) => prev + 1);
      setGeneralError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmailValid = emailTouched && email.trim() && validateEmail(email);
  const isFormValid = email.trim() && validateEmail(email) && password && validatePassword(password);

  return (
    <main className="login-container">
      {/* Background ambient lighting */}
      <div className="bg-shape bg-shape-1" aria-hidden="true"></div>
      <div className="bg-shape bg-shape-2" aria-hidden="true"></div>

      <div className="login-card-wrapper">
        {/* Parent Portal Header & Branding */}
        <header className="brand-header">
          <div className="brand-logo-badge" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <span className="brand-tag">Parent Portal</span>
          <h1 className="login-title">Welcome Back, Parents</h1>
          <p className="login-subtitle">
            Sign in to track your child's academic growth, attendance, and school updates.
          </p>
        </header>

        {/* Demo Quick Test Bar */}
        <section className="demo-presets-bar" aria-label="Demo Testing Shortcuts">
          <span className="demo-presets-label">⚡ Quick Test:</span>
          <button 
            type="button" 
            className="demo-chip chip-success"
            onClick={() => handleFillDemo("success")}
            title="Fill valid demo parent credentials"
          >
            Demo Parent
          </button>
          <button 
            type="button" 
            className="demo-chip chip-error"
            onClick={() => handleFillDemo("invalid_auth")}
            title="Simulate invalid login error"
          >
            Invalid Creds
          </button>
          <button 
            type="button" 
            className="demo-chip chip-warning"
            onClick={() => handleFillDemo("bad_email")}
            title="Simulate invalid email format"
          >
            Bad Email
          </button>
        </section>

        {/* Dedicated Visually Distinct Error Display Area */}
        {generalError && (
          <div 
            className="error-alert-banner" 
            role="alert" 
            aria-live="assertive"
            tabIndex={-1}
            ref={generalErrorRef}
          >
            <div className="error-alert-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="error-alert-content">
              <strong>Authentication Notice</strong>
              <p>{generalError}</p>
              {failedAttempts >= 2 && (
                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#991b1b",
                      fontWeight: "700",
                      textDecoration: "underline",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "13px"
                    }}
                    onClick={() => setIsForgotModalOpen(true)}
                  >
                    Having trouble signing in? Click here to reset your password.
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Core Parent Login Form */}
        <form onSubmit={handleSubmit} noValidate className="login-form">
          {/* Email Input Field */}
          <div className={`form-group ${emailError ? "has-error" : isEmailValid ? "is-valid" : ""}`}>
            <div className="label-row">
              <label htmlFor="parent-email">Parent Email Address</label>
              {isEmailValid && (
                <span className="valid-badge" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Valid format
                </span>
              )}
            </div>

            <div className="input-input-wrapper">
              <span className="field-prefix-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>

              <input
                ref={emailInputRef}
                id="parent-email"
                type="email"
                name="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                placeholder="Parent email address"
                autoComplete="email"
                required
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error-msg" : "email-helper-text"}
                disabled={isSubmitting || authLoading}
              />
            </div>

            {!emailError && (
              <small id="email-helper-text" className="helper-text">
                Enter the email address registered with your school district.
              </small>
            )}

            {emailError && (
              <div id="email-error-msg" className="field-error-message" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{emailError}</span>
              </div>
            )}
          </div>

          {/* Password Input Field */}
          <div className={`form-group ${passwordError ? "has-error" : ""}`}>
            <div className="label-row">
              <label htmlFor="parent-password">Your Account Password</label>
              <span className="char-count" aria-live="polite">
                {password.length >= 8 ? "✓ Min 8 chars" : `${password.length}/8 min chars`}
              </span>
            </div>

            <div className="password-input-wrapper">
              <span className="field-prefix-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>

              <input
                id="parent-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                placeholder="Your account password"
                autoComplete="current-password"
                minLength={8}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error-msg" : "password-hint-text"}
                disabled={isSubmitting || authLoading}
              />

              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting || authLoading}
                aria-label={showPassword ? "Hide password text" : "Show password text"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password text" : "Show password text"}
                </span>
              </button>
            </div>

            {/* Forgot Password Link & Helper */}
            <div className="password-options-row">
              <div id="password-hint-text" className="helper-text">
                Password must be at least 8 characters.
              </div>

              <button
                type="button"
                className="forgot-password-link"
                onClick={() => setIsForgotModalOpen(true)}
                disabled={isSubmitting || authLoading}
              >
                Forgot password?
              </button>
            </div>

            {passwordError && (
              <div id="password-error-msg" className="field-error-message" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{passwordError}</span>
              </div>
            )}
          </div>

          {/* Remember Me Checkbox Option */}
          <div className="checkbox-group">
            <label className="checkbox-label" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isSubmitting || authLoading}
              />
              <span className="custom-checkbox" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span className="checkbox-text">Keep me signed in on this device</span>
            </label>
          </div>

          {/* Prominent High-Contrast Login Button */}
          <button
            type="submit"
            className="submit-login-btn"
            disabled={isSubmitting || authLoading || !isFormValid}
            aria-busy={isSubmitting || authLoading}
          >
            {isSubmitting || authLoading ? (
              <span className="button-loading-state">
                <span className="btn-spinner" aria-hidden="true"></span>
                <span>Authenticating Parent Account...</span>
              </span>
            ) : (
              <span className="button-normal-state">
                <span>Sign In to Parent Portal</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            )}
          </button>
        </form>

        {/* Footer Support Info */}
        <footer className="card-footer-info">
          <p>
            Need help accessing your student's account? Contact school IT support at{" "}
            <a href="mailto:support@school.edu">support@school.edu</a>
          </p>
        </footer>
      </div>

      {/* Account Password Reset Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
      />
    </main>
  );
}

export default Login;
