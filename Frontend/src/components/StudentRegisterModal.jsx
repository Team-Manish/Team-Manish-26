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

        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
          Prospective students: create your account below. Your profile will be accessible to assigned educators.
        </p>

        {errorMsg && (
          <div style={{ padding: "10px", background: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>
            <strong>Registration Error:</strong> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: "10px", background: "#f0fdf4", color: "#166534", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex.johnson@student.com"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Username (Optional)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_j"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Student ID (Optional)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. STU-1001"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Password * (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Enrolled Subjects (comma-separated)
              </label>
              <input
                type="text"
                value={enrolledSubjects}
                onChange={(e) => setEnrolledSubjects(e.target.value)}
                placeholder="Computer Science, Math"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Assigned Teacher User ID (Optional)
            </label>
            <input
              type="text"
              value={assignedTeacherId}
              onChange={(e) => setAssignedTeacherId(e.target.value)}
              placeholder="e.g. TCH-2001"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#fff", fontWeight: "600", cursor: "pointer" }}
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
