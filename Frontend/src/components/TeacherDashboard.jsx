import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import StudentForm from "./StudentForm";
import StudentCard from "./StudentCard";
import ProgressUpdateForm from "./ProgressUpdateForm";
import AttendanceHeatmap from "./AttendanceHeatmap";
import StudentProgressWidget from "./StudentProgressWidget";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../services/studentService";
import "./Dashboard.css";

const TeacherDashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const [activeTab, setActiveTab] = useState("chart");
  const [students, setStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudentForChart, setSelectedStudentForChart] = useState(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchStudentsList = useCallback(async () => {
    setIsLoadingStudents(true);
    setApiError("");
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setApiError(err.message || "Failed to load student records");
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentsList();
  }, [fetchStudentsList]);

  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    setApiError("");
    setSuccessMessage("");
    try {
      if (editingStudent) {
        const updated = await updateStudent(editingStudent._id, formData);
        setStudents((prev) =>
          prev.map((s) => (s._id === editingStudent._id ? updated : s))
        );
        setSuccessMessage(`Updated student record for ${updated.name}`);
        setEditingStudent(null);
      } else {
        const created = await createStudent(formData);
        setStudents((prev) => [...prev, created]);
        setSuccessMessage(`Added student ${created.name} successfully`);
      }
    } catch (err) {
      setApiError(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student record?")) {
      return;
    }
    setDeletingId(id);
    setApiError("");
    setSuccessMessage("");
    try {
      await deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s._id !== id));
      setSuccessMessage("Student record deleted successfully");
      if (editingStudent && editingStudent._id === id) {
        setEditingStudent(null);
      }
    } catch (err) {
      setApiError(err.message || "Failed to delete student");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>👨‍🏫 Educator & Class Management Console</h1>
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

      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard Navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "chart"}
          className={`tab-btn ${activeTab === "chart" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("chart")}
        >
          📈 Academic Progress Chart
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "heatmap"}
          className={`tab-btn ${activeTab === "heatmap" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("heatmap")}
        >
          📊 Attendance Heatmap
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "progress"}
          className={`tab-btn ${activeTab === "progress" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("progress")}
        >
          📝 Progress & Grade Entry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "directory"}
          className={`tab-btn ${activeTab === "directory" ? "active-tab" : ""}`}
          onClick={() => setActiveTab("directory")}
        >
          📁 Class Roster & Student Directory ({students.length})
        </button>
      </div>

      {apiError && (
        <div className="dashboard-alert alert-error" role="alert">
          {apiError}
        </div>
      )}

      {successMessage && (
        <div className="dashboard-alert alert-success" role="status">
          {successMessage}
        </div>
      )}

      {activeTab === "chart" ? (
        <section aria-label="Student Academic Progress Chart">
          <StudentProgressWidget initialStudentId={selectedStudentForChart} />
        </section>
      ) : activeTab === "heatmap" ? (
        <section aria-label="Attendance Heatmap">
          <AttendanceHeatmap userRole="teacher" initialClass="Grade 10-A" />
        </section>
      ) : activeTab === "progress" ? (
        <section aria-label="Student Progress Entry">
          <ProgressUpdateForm />
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="dashboard-form-section" aria-labelledby="form-heading">
            <StudentForm
              onSubmit={handleFormSubmit}
              initialData={editingStudent}
              onCancel={() => setEditingStudent(null)}
              isSubmitting={isSubmitting}
            />
          </section>

          <section className="dashboard-list-section" aria-labelledby="list-heading">
            <div className="section-header">
              <h2 id="list-heading">Class Roster Directory</h2>
              <span className="count-badge">{students.length} Total</span>
            </div>

            {isLoadingStudents ? (
              <div className="loading-spinner">Loading student directory...</div>
            ) : students.length === 0 ? (
              <div className="empty-state">
                <p>No student records found. Add your first student using the form.</p>
              </div>
            ) : (
              <div className="student-cards-grid">
                {students.map((student) => (
                  <div key={student._id || student.studentId} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <StudentCard
                      student={student}
                      onEdit={(s) => {
                        setEditingStudent(s);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      onDelete={handleDelete}
                      isDeleting={deletingId === student._id}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", width: "100%", background: "var(--color-primary-light)", color: "var(--color-primary)", border: "1px solid rgba(59,130,246,0.3)", fontWeight: "600", cursor: "pointer" }}
                      onClick={() => {
                        setSelectedStudentForChart(student.studentId || student.id || student._id);
                        setActiveTab("chart");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      📈 View Progress Chart
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
};

export default TeacherDashboard;
