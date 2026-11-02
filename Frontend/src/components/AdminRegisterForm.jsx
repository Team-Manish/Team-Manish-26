import { useState } from "react";
import { registerUserByAdmin } from "../auth/authService";
import "./AdminRegisterForm.css";

const AdminRegisterForm = ({ onSuccess, onCancel }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("General Academics");
  const [linkedStudentIds, setLinkedStudentIds] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Helper to generate a random strong password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
  };

  const handleResetForm = () => {
    setName("");
    setEmail("");
    setRole("teacher");
    setPassword("");
    setDepartment("General Academics");
    setLinkedStudentIds("");
    setErrorMsg("");
    setSuccessData(null);
    setCopied(false);
  };

  const handleCancelClick = () => {
    handleResetForm();
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // Client-side validations
    if (!name.trim()) {
      setErrorMsg("Full name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("A valid email address is required.");
      return;
    }
    if (!role) {
      setErrorMsg("Please select a role.");
      return;
    }
    if (!password || password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        role,
        password,
        ...(role === "teacher" && { department: department.trim() }),
        ...(role === "parent" && { linkedStudentIds: linkedStudentIds.trim() }),
      };

      const response = await registerUserByAdmin(payload);
      
      const createdAccount = {
        ...response.user,
        initialPassword: password,
      };

      setSuccessData(createdAccount);
      if (onSuccess) {
        onSuccess(response.user);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to register user account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const credText = `User Credentials:\nName: ${successData.name}\nEmail: ${successData.email}\nRole: ${successData.role.toUpperCase()}\nUser ID: ${successData.userId}\nTemporary Password: ${successData.initialPassword}`;
    navigator.clipboard.writeText(credText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="admin-register-container">
      <div className="admin-register-card">
        <div className="admin-register-header">
          <h2>🛡️ Admin Registration Form</h2>
          <p>Create new Teacher or Parent accounts with secure access rights.</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="register-alert register-alert-error" role="alert" id="register-error-alert">
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">
              <strong>Registration Failed</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Success Confirmation Card with Secure Credentials */}
        {successData ? (
          <div className="register-success-view">
            <div className="register-alert register-alert-success">
              <span className="alert-icon">✅</span>
              <div className="alert-content">
                <strong>Account Registered Successfully!</strong>
                <p>New user account has been saved to the database.</p>
              </div>
            </div>

            <div className="credentials-secure-box">
              <h3>🔑 Secure Account Credentials</h3>
              <p className="credentials-subtext">Provide these credentials securely to the new user:</p>

              <div className="credentials-grid">
                <div className="cred-item">
                  <span className="cred-label">Full Name:</span>
                  <span className="cred-value">{successData.name}</span>
                </div>

                <div className="cred-item">
                  <span className="cred-label">Email Address:</span>
                  <span className="cred-value">{successData.email}</span>
                </div>

                <div className="cred-item">
                  <span className="cred-label">Account Role:</span>
                  <span className="cred-badge role-badge">{successData.role}</span>
                </div>

                <div className="cred-item">
                  <span className="cred-label">Assigned User ID:</span>
                  <span className="cred-value font-mono">{successData.userId}</span>
                </div>

                {successData.department && (
                  <div className="cred-item">
                    <span className="cred-label">Department:</span>
                    <span className="cred-value">{successData.department}</span>
                  </div>
                )}

                <div className="cred-item full-width">
                  <span className="cred-label">Temporary Password:</span>
                  <code className="password-display">{successData.initialPassword}</code>
                </div>
              </div>

              <div className="credentials-actions">
                <button
                  type="button"
                  className="btn-copy-cred"
                  onClick={handleCopyCredentials}
                >
                  {copied ? "✓ Credentials Copied!" : "📋 Copy Credentials"}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleResetForm}
                >
                  + Register Another User
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="admin-register-form" noValidate>
            <div className="form-group">
              <label htmlFor="reg-name">Full Name <span className="required-star">*</span></label>
              <input
                id="reg-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Eleanor Vance or John Doe"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">Email Address <span className="required-star">*</span></label>
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user@school.com"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-role">Account Role <span className="required-star">*</span></label>
              <select
                id="reg-role"
                name="role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-select"
              >
                <option value="teacher">👨‍🏫 Teacher Account</option>
                <option value="parent">👨‍👩‍👧 Parent Account</option>
                <option value="student">🎓 Student Account</option>
                <option value="user">👤 General User Account</option>
              </select>
            </div>

            {/* Dynamic Role-Specific Fields */}
            {role === "teacher" && (
              <div className="form-group">
                <label htmlFor="reg-department">Department</label>
                <input
                  id="reg-department"
                  name="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Science & Math or Computer Science"
                  className="form-input"
                />
              </div>
            )}

            {role === "parent" && (
              <div className="form-group">
                <label htmlFor="reg-linked-students">Linked Student IDs (Optional)</label>
                <input
                  id="reg-linked-students"
                  name="linkedStudentIds"
                  type="text"
                  value={linkedStudentIds}
                  onChange={(e) => setLinkedStudentIds(e.target.value)}
                  placeholder="e.g. STU-1001, STU-1002"
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <div className="label-with-action">
                <label htmlFor="reg-password">Password <span className="required-star">*</span> (min 8 chars)</label>
                <button
                  type="button"
                  className="btn-text-action"
                  onClick={generatePassword}
                >
                  🎲 Generate Secure Password
                </button>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈 Hide" : "👁️ Show"}
                </button>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelClick}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Registering User..." : "Submit / Create Account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminRegisterForm;
