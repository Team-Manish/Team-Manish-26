import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import "./Dashboard.css";

const StudentDashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState("Computer Science");

  const enrolledSubjects = [
    {
      id: "cs101",
      name: "Computer Science",
      code: "CS-101",
      grade: "92.5%",
      letterGrade: "A",
      instructor: "Prof. Alan Turing",
      completion: 85,
      timeSpent: "140 mins",
      topics: [
        { title: "Algorithms & Complexity", status: "Completed", score: "95%" },
        { title: "Data Structures & Trees", status: "Completed", score: "90%" },
        { title: "Database Systems (SQL)", status: "In Progress", score: "88%" },
        { title: "System Architecture", status: "Pending", score: "—" },
      ],
      remarks: "Outstanding performance in algorithmic problem solving and lab assignments.",
    },
    {
      id: "math201",
      name: "Advanced Mathematics",
      code: "MATH-201",
      grade: "88.0%",
      letterGrade: "B+",
      instructor: "Dr. Katherine Johnson",
      completion: 78,
      timeSpent: "115 mins",
      topics: [
        { title: "Linear Algebra & Vectors", status: "Completed", score: "88%" },
        { title: "Multivariable Calculus", status: "In Progress", score: "85%" },
        { title: "Differential Equations", status: "Pending", score: "—" },
      ],
      remarks: "Strong analytical capability; continue practicing vector spaces.",
    },
    {
      id: "phys102",
      name: "Quantum Physics",
      code: "PHYS-102",
      grade: "95.0%",
      letterGrade: "A+",
      instructor: "Dr. Richard Feynman",
      completion: 92,
      timeSpent: "160 mins",
      topics: [
        { title: "Wave Mechanics", status: "Completed", score: "98%" },
        { title: "Quantum Entanglement", status: "Completed", score: "94%" },
        { title: "Thermodynamics", status: "Completed", score: "93%" },
      ],
      remarks: "Exceptional mastery of quantum mechanics principles and lab experiments.",
    },
  ];

  const activeSubjectData = enrolledSubjects.find((s) => s.name === selectedSubject) || enrolledSubjects[0];

  return (
    <main className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-title">
          <h1>🎓 Student Learning & Academic Portal</h1>
          <p className="user-badge">
            Signed in as: <strong>{user?.email}</strong>{" "}
            <span style={{ textTransform: "uppercase", padding: "2px 8px", background: "var(--color-primary-light)", color: "var(--color-primary)", borderRadius: "12px", fontWeight: "bold", fontSize: "12px", marginLeft: "6px" }}>
              {user?.role || "student"}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle />
          <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      {/* Summary Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Overall Cumulative GPA</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-primary)", fontSize: "28px" }}>3.85 / 4.0</h2>
          <span style={{ color: "var(--color-success-text)", fontSize: "12px", fontWeight: "600" }}>↑ Top 5% Rank</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Enrolled Courses</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-text-main)", fontSize: "28px" }}>{enrolledSubjects.length} Courses</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Active Semester</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Study Time Logged</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-accent-amber)", fontSize: "28px" }}>415 Mins</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>This Term</span>
        </div>
      </div>

      {/* Subject Selection Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {enrolledSubjects.map((sub) => (
          <button
            key={sub.id}
            type="button"
            className="tab-btn-chip"
            onClick={() => setSelectedSubject(sub.name)}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: selectedSubject === sub.name ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              background: selectedSubject === sub.name ? "var(--color-primary-light)" : "var(--color-card-bg)",
              color: selectedSubject === sub.name ? "var(--color-primary)" : "var(--color-text-main)",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: selectedSubject === sub.name ? "0 4px 12px rgba(99, 102, 241, 0.2)" : "none",
            }}
          >
            {sub.name} ({sub.grade})
          </button>
        ))}
      </div>

      {/* Active Subject Details */}
      <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", color: "var(--color-text-main)" }}>{activeSubjectData.name} ({activeSubjectData.code})</h2>
            <p style={{ margin: "4px 0 0 0", color: "var(--color-text-muted)", fontSize: "14px" }}>Instructor: {activeSubjectData.instructor}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "24px", fontWeight: "bold", color: "var(--color-primary)" }}>{activeSubjectData.grade}</span>
            <span style={{ marginLeft: "10px", padding: "4px 10px", background: "var(--color-success-bg)", color: "var(--color-success-text)", borderRadius: "8px", fontWeight: "bold" }}>Grade {activeSubjectData.letterGrade}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "6px" }}>
            <span>Syllabus Completion</span>
            <strong>{activeSubjectData.completion}%</strong>
          </div>
          <div style={{ background: "var(--color-border)", borderRadius: "8px", height: "10px", overflow: "hidden" }}>
            <div style={{ background: "var(--color-primary)", height: "100%", width: `${activeSubjectData.completion}%`, borderRadius: "8px", transition: "width 0.5s ease" }}></div>
          </div>
        </div>

        {/* Topics Table */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--color-text-main)" }}>Topic & Module Breakdown</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left", color: "var(--color-text-muted)" }}>
              <th style={{ padding: "10px 8px" }}>Topic Title</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Evaluation Score</th>
            </tr>
          </thead>
          <tbody>
            {activeSubjectData.topics.map((t, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "12px 8px", fontWeight: "500" }}>{t.title}</td>
                <td style={{ padding: "12px 8px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", background: t.status === "Completed" ? "var(--color-success-bg)" : "var(--color-primary-light)", color: t.status === "Completed" ? "var(--color-success-text)" : "var(--color-primary)" }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>{t.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Instructor Remarks */}
        <div style={{ background: "var(--color-primary-light)", borderLeft: "4px solid var(--color-primary)", padding: "14px 18px", borderRadius: "0 10px 10px 0" }}>
          <strong style={{ color: "var(--color-primary)", fontSize: "13px", display: "block", marginBottom: "4px" }}>INSTRUCTOR REMARKS & FEEDBACK</strong>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-main)" }}>"{activeSubjectData.remarks}"</p>
        </div>
      </div>
    </main>
  );
};

export default StudentDashboard;
