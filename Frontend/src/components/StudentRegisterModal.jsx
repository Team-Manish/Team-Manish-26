import { useState } from "react";
import { registerStudent } from "../auth/authService";
import "./ForgotPasswordModal.css"; // Reuse modal overlay styles

function StudentRegisterModal({ isOpen, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("18");
  const [enrolledSubjects, setEnrolledSubjects] = useState("Computer Science, Mathematics");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg("Name, Email, and Password (min 8 chars) are required.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      const subjectsArray = enrolledSubjects
        ? enrolledSubjects.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      await registerStudent({
        name: name.trim(),
        email: email.trim(),
        username: username.trim() || undefined,
        userId: userId.trim() || undefined,
        password,
        age: Number(age) || 18,
        enrolledSubjects: subjectsArray,
        assignedTeacherId: assignedTeacherId.trim() || undefined,
      });

      setSuccessMsg("Account created successfully! You can now log in to the Student Portal.");
      setTimeout(() => {
        onClose();
        setSuccessMsg("");
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create student account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="register-modal-title">
      <div className="modal-card" style={{ maxWidth: "500px", padding: "24px" }}>
        <header className="modal-header">
          <h2 id="register-modal-title" style={{ margin: 0, fontSize: "20px" }}>
            🎓 Student Self-Registration
          </h2>
          <button type="button" className="close-modal-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </header>

        <p style={{ color: "var(--color-text-muted)", fontSize: "14px", marginBottom: "16px" }}>
          Prospective students: create your account below. Your profile will be accessible to assigned educators.
        </p>

        {errorMsg && (
          <div style={{ padding: "10px", background: "var(--color-error-bg)", color: "var(--color-error-text)", border: "1px solid var(--color-error-border)", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>
            <strong>Registration Error:</strong> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: "10px", background: "var(--color-success-bg)", color: "var(--color-success-text)", border: "1px solid var(--color-success-text)", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label htmlFor="reg-name" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
              Full Name *
            </label>
            <input
              id="reg-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
            />
          </div>

          <div>
            <label htmlFor="reg-email" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
              Email Address *
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex.johnson@student.com"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label htmlFor="reg-username" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
                Username (Optional)
              </label>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_j"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
              />
            </div>
            <div>
              <label htmlFor="reg-user-id" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
                Student ID (Optional)
              </label>
              <input
                id="reg-user-id"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. STU-1001"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
              Password * (min 8 chars)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
            <div>
              <label htmlFor="reg-age" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
                Age
              </label>
              <input
                id="reg-age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
              />
            </div>
            <div>
              <label htmlFor="reg-subjects" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
                Enrolled Subjects (comma-separated)
              </label>
              <input
                id="reg-subjects"
                type="text"
                value={enrolledSubjects}
                onChange={(e) => setEnrolledSubjects(e.target.value)}
                placeholder="Computer Science, Math"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-teacher-id" style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px", color: "var(--color-text-main)" }}>
              Assigned Teacher User ID (Optional)
            </label>
            <input
              id="reg-teacher-id"
              type="text"
              value={assignedTeacherId}
              onChange={(e) => setAssignedTeacherId(e.target.value)}
              placeholder="e.g. TCH-2001"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-input-bg)", color: "var(--color-text-main)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: "10px 20px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ padding: "10px 20px" }}
            >
              {isSubmitting ? "Creating Account..." : "Register Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StudentRegisterModal;
