import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { validateResetToken, resetPassword } from "../auth/authService";
import { extractTokenFromHash, scrubFragmentFromHistory } from "../utils/resetToken";
import ThemeToggle from "./ThemeToggle";
import "./ResetPassword.css";

function ResetPassword() {
  const navigate = useNavigate();

  // Extract token strictly from URL fragment (#token=...). Query parameter fallback is completely removed.
  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      const extractedToken = extractTokenFromHash(window.location.hash || "");
      if (extractedToken) {
        // Scrub the sensitive token fragment from the visible browser address bar and history
        scrubFragmentFromHistory(window);
        return extractedToken;
      }
    }
    return "";
  });

  const [tokenStatus, setTokenStatus] = useState("verifying"); // 'verifying', 'valid', 'invalid'
  const [statusMessage, setStatusMessage] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token || !token.trim()) {
      setTokenStatus("invalid");
      setStatusMessage("No password reset token was provided in the link.");
      return;
    }

    let isMounted = true;

    const checkToken = async () => {
      setTokenStatus("verifying");
      const res = await validateResetToken(token);
      if (!isMounted) return;

      if (res.valid) {
        setTokenStatus("valid");
      } else {
        setTokenStatus("invalid");
        setStatusMessage(res.message || "This password reset link is invalid or has expired.");
      }
    };

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setGeneralError("");

    if (!newPassword) {
      setPasswordError("New password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPassword(token, newPassword);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setGeneralError(res.message || "Failed to reset password.");
      }
    } catch (err) {
      setGeneralError(err.message || "An unexpected error occurred during password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="reset-password-container">
      <div className="reset-password-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span className="reset-badge">🔑 Password Recovery</span>
          <ThemeToggle />
        </div>

        {/* Verifying Token Loader */}
        {tokenStatus === "verifying" && (
          <div className="status-state-box">
            <div className="reset-spinner"></div>
            <h2>Validating Security Token...</h2>
            <p>Please wait while we verify your password reset link.</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {tokenStatus === "invalid" && (
          <div className="status-state-box error-box">
            <div className="status-icon icon-error">⚠️</div>
            <h2>Invalid or Expired Link</h2>
            <p>{statusMessage}</p>
            <div className="status-actions">
              <Link to="/login" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
                Return to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Valid Token & Form / Success State */}
        {tokenStatus === "valid" && (
          <>
            {!isSuccess ? (
              <>
                <header className="reset-header">
                  <h2>Set Your New Password</h2>
                  <p>
                    Please enter a new secure password for your account. Passwords must be at least 8 characters long.
                  </p>
                </header>

                {generalError && (
                  <div className="reset-alert alert-error" role="alert">
                    <span>⚠️ {generalError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="reset-form">
                  <div className="form-group">
                    <label htmlFor="new-password">New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (passwordError) setPasswordError("");
                        }}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        disabled={isSubmitting}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="toggle-password-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password">Confirm New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (passwordError) setPasswordError("");
                        }}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        disabled={isSubmitting}
                      />
                    </div>
                    {passwordError && (
                      <div className="field-error" role="alert">
                        <span>⚠️ {passwordError}</span>
                      </div>
                    )}
                  </div>

                  <div className="password-rules">
                    <span className={newPassword.length >= 8 ? "rule-met" : "rule-unmet"}>
                      {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                    </span>
                    <span className={newPassword && newPassword === confirmPassword ? "rule-met" : "rule-unmet"}>
                      {newPassword && newPassword === confirmPassword ? "✓" : "○"} Passwords match
                    </span>
                  </div>

                  <div className="reset-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate("/login")}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                    >
                      {isSubmitting ? "Updating Password..." : "Submit & Save Password"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="status-state-box success-box">
                <div className="status-icon icon-success">✅</div>
                <h2>Password Reset Successful!</h2>
                <p>
                  Your account password has been updated securely. Your reset token has been cleared, and you can now log in with your new password.
                </p>
                <div className="status-actions">
                  <button
                    type="button"
                    className="btn-primary btn-full"
                    onClick={() => navigate("/login")}
                  >
                    Proceed to Sign In ➔
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default ResetPassword;
