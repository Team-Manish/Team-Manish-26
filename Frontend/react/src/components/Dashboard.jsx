import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/useAuth";
import StudentForm from "./StudentForm";
import StudentCard from "./StudentCard";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../services/studentService";
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();
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
          <h1>Student Management Dashboard</h1>
          <p className="user-badge">
            Signed in as: <strong>{user?.email}</strong> ({user?.role})
          </p>
        </div>
        <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut ? "Logging out..." : "Logout"}
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
    </main>
  );
};

export default Dashboard;
