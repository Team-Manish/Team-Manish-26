import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { validateResetToken, resetPassword } from "../auth/authService";
import ThemeToggle from "./ThemeToggle";
import "./ResetPassword.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [tokenStatus, setTokenStatus] = useState("verifying"); // 'verifying', 'valid', 'invalid'
  const [userEmail, setUserEmail] = useState("");
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
    if (!token) {
      setTokenStatus("invalid");
      setStatusMessage("No password reset token was provided in the request link.");
      return;
    }

    const checkToken = async () => {
      setTokenStatus("verifying");
      const res = await validateResetToken(token);
      if (res.valid) {
        setTokenStatus("valid");
        setUserEmail(res.email || "");
      } else {
        setTokenStatus("invalid");
        setStatusMessage(res.message || "Password reset token is invalid or has expired.");
      }
    };

    checkToken();
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
              <Link to="/login" className="btn-primary" style={{ textDecoration: "none" }}>
                Return to Login
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
                    Enter a new secure password for account{" "}
                    <strong>{userEmail || "associated with token"}</strong>.
                  </p>
                </header>

                {generalError && (
                  <div className="reset-alert alert-error" role="alert">
                    <span>⚠️ {generalError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="reset-form">
                  <div className="form-group">
                    <label htmlFor="new-password">New Password (min 8 chars)</label>
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
                  Your account password has been updated securely. Your reset token has been cleared, and you can now log in with your new credentials.
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
