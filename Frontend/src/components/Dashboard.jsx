import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/useAuth";
import StudentForm from "./StudentForm";
import StudentCard from "./StudentCard";
import ProgressUpdateForm from "./ProgressUpdateForm";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../services/studentService";
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const [activeTab, setActiveTab] = useState("progress"); // 'progress' | 'directory'
  const [students, setStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
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
          <h1>
            {user?.role === "teacher" && "👨‍🏫 Educator & Class Management Console"}
            {user?.role === "parent" && "👨‍👩‍👧 Parent Portal - Child Progress Tracker"}
            {user?.role === "admin" && "🛡️ System Administration & Telemetry Portal"}
            {(user?.role === "user" || user?.role === "student" || !["teacher", "parent", "admin"].includes(user?.role)) && "🎓 Student Learning & Academic Portal"}
          </h1>
          <p className="user-badge">
            Signed in as: <strong>{user?.email}</strong> <span style={{ textTransform: "uppercase", padding: "2px 8px", background: "#eef2ff", color: "#4f46e5", borderRadius: "12px", fontWeight: "bold", fontSize: "12px", marginLeft: "6px" }}>{user?.role || "user"}</span>
          </p>
        </div>
        <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard Navigation">
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
          📁 Student Directory ({students.length})
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

      {activeTab === "progress" ? (
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
              <h2 id="list-heading">Student Directory</h2>
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
                  <StudentCard
                    key={student._id}
                    student={student}
                    onEdit={(s) => {
                      setEditingStudent(s);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onDelete={handleDelete}
                    isDeleting={deletingId === student._id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
};

export default Dashboard;

