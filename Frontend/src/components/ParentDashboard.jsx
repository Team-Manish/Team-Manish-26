import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import "./Dashboard.css";

const ParentDashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState("STU-1001");

  const childrenRecords = [
    {
      id: "STU-1001",
      name: "Jane Doe",
      gradeLevel: "Grade 11 - Science Track",
      overallStanding: "92.5%",
      gpa: "3.9 / 4.0",
      attendanceRate: "98.5%",
      unreadMessages: 1,
      subjects: [
        {
          subject: "Computer Science",
          score: "92.5%",
          grade: "A",
          timeSpent: "140 mins",
          attendance: "100%",
          teacherNote: "Jane shows exceptional analytical problem solving skills in Python & Data Structures.",
        },
        {
          subject: "Advanced Mathematics",
          score: "88.0%",
          grade: "B+",
          timeSpent: "115 mins",
          attendance: "96%",
          teacherNote: "Consistent homework completion. Recommended focusing on vector calculus practice.",
        },
        {
          subject: "Quantum Physics",
          score: "95.0%",
          grade: "A+",
          timeSpent: "160 mins",
          attendance: "99%",
          teacherNote: "Top performing student in thermodynamics lab experiments.",
        },
      ],
    },
    {
      id: "STU-1002",
      name: "Alex Doe",
      gradeLevel: "Grade 9 - Standard Track",
      overallStanding: "89.0%",
      gpa: "3.7 / 4.0",
      attendanceRate: "96.0%",
      unreadMessages: 0,
      subjects: [
        {
          subject: "Biology & Ecology",
          score: "91.0%",
          grade: "A",
          timeSpent: "95 mins",
          attendance: "98%",
          teacherNote: "Great participation in group lab work.",
        },
        {
          subject: "World History",
          score: "87.0%",
          grade: "B+",
          timeSpent: "80 mins",
          attendance: "94%",
          teacherNote: "Well written essay submissions.",
        },
      ],
    },
  ];

  const currentChild = childrenRecords.find((c) => c.id === selectedChildId) || childrenRecords[0];

  return (
    <main className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>👨‍👩‍👧 Parent Portal - Child Progress Tracker</h1>
          <p className="user-badge">
            Signed in as: <strong>{user?.email}</strong>{" "}
            <span style={{ textTransform: "uppercase", padding: "2px 8px", background: "var(--color-primary-light)", color: "var(--color-primary)", borderRadius: "12px", fontWeight: "bold", fontSize: "12px", marginLeft: "6px" }}>
              {user?.role}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle />
          <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Child Selection Header */}
      <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", marginBottom: "24px", boxShadow: "var(--shadow-card)" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", color: "var(--color-text-muted)" }}>LINKED CHILDREN PROFILE</h3>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {childrenRecords.map((child) => (
            <button
              key={child.id}
              type="button"
              className="tab-btn-chip"
              onClick={() => setSelectedChildId(child.id)}
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                border: selectedChildId === child.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                background: selectedChildId === child.id ? "var(--color-primary-light)" : "var(--color-input-bg)",
                color: selectedChildId === child.id ? "var(--color-primary)" : "var(--color-text-main)",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: selectedChildId === child.id ? "0 4px 12px rgba(99, 102, 241, 0.2)" : "none",
              }}
            >
              <span>👤 {child.name}</span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>({child.id})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Child Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Academic Standing</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-primary)", fontSize: "28px" }}>{currentChild.overallStanding}</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>GPA: {currentChild.gpa}</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Attendance Rate</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-success-text)", fontSize: "28px" }}>{currentChild.attendanceRate}</h2>
          <span style={{ color: "var(--color-success-text)", fontSize: "12px", fontWeight: "600" }}>✓ Excellent Record</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Enrolled Subjects</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-text-main)", fontSize: "28px" }}>{currentChild.subjects.length} Subjects</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{currentChild.gradeLevel}</span>
        </div>
      </div>

      {/* Subject Progress Reports */}
      <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px", boxShadow: "var(--shadow-card)" }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", color: "var(--color-text-main)" }}>Detailed Subject Evaluation Reports</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {currentChild.subjects.map((sub, idx) => (
            <div key={idx} style={{ background: "var(--color-input-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: "var(--color-text-main)" }}>{sub.subject}</h3>
                <div>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: "var(--color-primary)", marginRight: "8px" }}>{sub.score}</span>
                  <span style={{ padding: "4px 10px", background: "var(--color-success-bg)", color: "var(--color-success-text)", borderRadius: "8px", fontWeight: "bold", fontSize: "13px" }}>Grade {sub.grade}</span>
                </div>
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
                Attendance: <strong>{sub.attendance}</strong> | Study Time: <strong>{sub.timeSpent}</strong>
              </p>
              <div style={{ background: "var(--color-card-bg)", padding: "12px 16px", borderRadius: "10px", borderLeft: "4px solid var(--color-primary)", fontSize: "14px" }}>
                <strong style={{ color: "var(--color-primary)", fontSize: "12px", display: "block", marginBottom: "2px" }}>TEACHER EVALUATION & NOTES</strong>
                "{sub.teacherNote}"
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default ParentDashboard;
