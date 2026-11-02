import { useState, useEffect, useRef } from "react";
import { requestPasswordReset } from "../auth/authService";
import "./ForgotPasswordModal.css";

function ForgotPasswordModal({ isOpen, onClose, initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    setEmail(initialEmail);
    setEmailError("");
    setGeneralError("");
    setIsSuccess(false);
  }, [initialEmail, isOpen]);

  // Trap focus inside modal when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateEmail = (val) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError("");
    setGeneralError("");

    if (!email.trim()) {
      setEmailError("Please enter your registered email address.");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email format (e.g. user@example.com).");
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setIsSuccess(true);
    } catch (err) {
      setGeneralError(err.message || "Failed to send password reset request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="forgot-password-title"
        ref={modalRef}
      >
        <button 
          className="modal-close-btn" 
          onClick={onClose} 
          aria-label="Close password recovery dialog"
          type="button"
        >
          &times;
        </button>

        {!isSuccess ? (
          <>
            <div className="modal-header">
              <div className="modal-icon-badge" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h2 id="forgot-password-title">Reset Your Password</h2>
              <p className="modal-subtitle">
                Enter your registered account email address. If an account is found, we will dispatch instructions to reset your password.
              </p>
            </div>

            {generalError && (
              <div
                className="field-error"
                style={{
                  marginBottom: "12px",
                  background: "#fef2f2",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #fecaca",
                }}
                role="alert"
              >
                <span>⚠️ {generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="recovery-email">Account Email Address</label>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                    if (generalError) setGeneralError("");
                  }}
                  placeholder="Registered email address"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "recovery-email-error" : undefined}
                  autoFocus
                  disabled={isSubmitting}
                />
                {emailError && (
                  <div id="recovery-email-error" className="field-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{emailError}</span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="spinner-container">
                      <span className="spinner" aria-hidden="true"></span>
                      <span>Processing...</span>
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="modal-success-state">
            <div className="success-icon-badge" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2>Password Request Processed</h2>
            <p>
              If an active account is associated with that email, a secure time-limited password reset link has been dispatched.
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted, #64748b)", marginTop: "8px" }}>
              Please check your inbox (and spam folder). Reset links expire after 15 minutes.
            </p>
            <button
              type="button"
              className="btn-primary btn-full"
              onClick={onClose}
              autoFocus
              style={{ marginTop: "16px" }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
