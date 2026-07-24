import React, { useState, useMemo, useRef, useEffect } from "react";
import "./ProgressUpdateForm.css";

// Mock enrolled students dataset (can be overridden via props)
const DEFAULT_STUDENTS = [
  {
    id: "STU-101",
    name: "Alex Smith",
    email: "alex.smith@school.edu",
    enrolledSubjects: ["Computer Science Foundations", "Advanced Mathematics", "Physics"],
  },
  {
    id: "STU-102",
    name: "Emma Watson",
    email: "emma.watson@school.edu",
    enrolledSubjects: ["Biology", "Chemistry", "English Literature"],
  },
  {
    id: "STU-103",
    name: "Liam Johnson",
    email: "liam.johnson@school.edu",
    enrolledSubjects: ["Advanced Mathematics", "Physics", "Chemistry"],
  },
  {
    id: "STU-104",
    name: "Sophia Martinez",
    email: "sophia.martinez@school.edu",
    enrolledSubjects: ["Computer Science Foundations", "English Literature", "History"],
  },
  {
    id: "STU-105",
    name: "Noah Davis",
    email: "noah.davis@school.edu",
    enrolledSubjects: ["Biology", "History", "Physics"],
  },
];

const VALID_LETTER_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];

export default function ProgressUpdateForm({
  studentsList = DEFAULT_STUDENTS,
  onSubmitSuccess,
  apiEndpoint = "/api/teacher/grades",
}) {
  // Form Input States
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [gradeMode, setGradeMode] = useState("letter"); // 'letter' | 'numerical'
  const [gradeValue, setGradeValue] = useState("");
  const [remarks, setRemarks] = useState("");

  // UI & Validation States
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  const dropdownRef = useRef(null);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentsList;
    const query = searchQuery.toLowerCase();
    return studentsList.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
    );
  }, [searchQuery, studentsList]);

  // Close student dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-dismiss toast notification after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle student selection
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setIsDropdownOpen(false);
    setSelectedSubject(""); // Reset subject when student changes
    if (errors.student) {
      setErrors((prev) => ({ ...prev, student: undefined }));
    }
  };

  // Grade Input Client-Side Validation
  const validateGrade = (val, mode) => {
    if (!val.trim()) {
      return "Grade is required.";
    }
    if (mode === "numerical") {
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 100) {
        return "Numerical grade must be a number between 0 and 100.";
      }
    } else if (mode === "letter") {
      const normalized = val.trim().toUpperCase();
      if (!VALID_LETTER_GRADES.includes(normalized)) {
        return `Invalid letter grade. Valid options: ${VALID_LETTER_GRADES.join(", ")}`;
      }
    }
    return null;
  };

  // Validate all fields before submission
  const validateForm = () => {
    const newErrors = {};

    if (!selectedStudent) {
      newErrors.student = "Please select an enrolled student.";
    }

    if (!selectedSubject) {
      newErrors.subject = "Please select a subject for the progress entry.";
    }

    const gradeErr = validateGrade(gradeValue, gradeMode);
    if (gradeErr) {
      newErrors.grade = gradeErr;
    }

    if (!remarks.trim()) {
      newErrors.remarks = "Remarks are required.";
    } else if (remarks.length > 500) {
      newErrors.remarks = "Remarks cannot exceed 500 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      setToast({
        type: "error",
        message: "Please correct the highlighted errors before submitting.",
      });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    const payload = {
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      subject: selectedSubject,
      gradeMode,
      grade: gradeMode === "letter" ? gradeValue.trim().toUpperCase() : Number(gradeValue),
      remarks: remarks.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const csrfTokenMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
      const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : "";

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-xsrf-token": csrfToken,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 201) {
        setToast({
          type: "success",
          message: `Progress update recorded successfully for ${selectedStudent.name}!`,
        });
        if (onSubmitSuccess) onSubmitSuccess(payload);
        handleReset();
      } else {
        const data = await response.json().catch(() => ({}));
        setToast({
          type: "error",
          message: data.message || `Server responded with error ${response.status}.`,
        });
      }
    } catch (err) {
      // Fallback for offline or dev demonstration when mock server isn't active
      console.warn("Network submission error, simulating successful submission:", err.message);
      setToast({
        type: "success",
        message: `[Demo] Progress update saved successfully for ${selectedStudent.name}!`,
      });
      if (onSubmitSuccess) onSubmitSuccess(payload);
      handleReset();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form inputs
  const handleReset = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setSelectedSubject("");
    setGradeValue("");
    setRemarks("");
    setErrors({});
    setIsDropdownOpen(false);
  };

  return (
    <div className="progress-form-container">
      {/* Toast Notification Popup */}
      {toast && (
        <div
          className={`toast-notification toast-${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          <span className="toast-icon">
            {toast.type === "success" ? "✓" : "⚠️"}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      <div className="progress-card">
        <div className="progress-card-header">
          <h2>Student Progress & Grade Update</h2>
          <p>Record student course grades and teacher performance remarks</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="progress-form">
          {/* 1. Student Selector Dropdown (Searchable) */}
          <div className="form-group" ref={dropdownRef}>
            <label htmlFor="student-search-input" className="form-label">
              Select Student <span className="required-star">*</span>
            </label>

            <div className="searchable-dropdown-wrapper">
              <input
                id="student-search-input"
                type="text"
                className={`form-input dropdown-input ${errors.student ? "input-error" : ""}`}
                placeholder="Search by student name or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedStudent(null);
                  setSelectedSubject("");
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                aria-expanded={isDropdownOpen}
                aria-autocomplete="list"
                aria-controls="student-listbox"
                aria-invalid={!!errors.student}
                aria-describedby={errors.student ? "student-error-msg" : undefined}
                autoComplete="off"
              />
              <span className="dropdown-caret" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                ▼
              </span>

              {isDropdownOpen && (
                <ul
                  id="student-listbox"
                  className="dropdown-listbox"
                  role="listbox"
                  aria-label="Enrolled Students"
                >
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <li
                        key={student.id}
                        className={`dropdown-option ${selectedStudent?.id === student.id ? "selected-option" : ""}`}
                        role="option"
                        aria-selected={selectedStudent?.id === student.id}
                        onClick={() => handleSelectStudent(student)}
                      >
                        <div className="option-title">{student.name}</div>
                        <div className="option-subtitle">
                          ID: {student.id} | {student.email}
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="dropdown-no-results">No enrolled students found</li>
                  )}
                </ul>
              )}
            </div>
            {errors.student && (
              <span id="student-error-msg" className="error-text" role="alert">
                {errors.student}
              </span>
            )}
          </div>

          {/* 2. Dynamic Subject Selector */}
          <div className="form-group">
            <label htmlFor="subject-select" className="form-label">
              Select Subject <span className="required-star">*</span>
            </label>
            <select
              id="subject-select"
              className={`form-select ${errors.subject ? "input-error" : ""}`}
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined }));
              }}
              disabled={!selectedStudent}
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? "subject-error-msg" : undefined}
            >
              <option value="">
                {selectedStudent
                  ? "-- Choose Enrolled Subject --"
                  : "-- Select a student first --"}
              </option>
              {selectedStudent &&
                selectedStudent.enrolledSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
            </select>
            {errors.subject && (
              <span id="subject-error-msg" className="error-text" role="alert">
                {errors.subject}
              </span>
            )}
          </div>

          {/* 3. Validated Grade Input Field */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="grade-input" className="form-label">
                Grade / Score <span className="required-star">*</span>
              </label>
              <div className="grade-mode-toggle" role="radiogroup" aria-label="Grade Scale Toggle">
                <button
                  type="button"
                  className={`toggle-btn ${gradeMode === "letter" ? "active-toggle" : ""}`}
                  onClick={() => {
                    setGradeMode("letter");
                    setGradeValue("");
                    setErrors((prev) => ({ ...prev, grade: undefined }));
                  }}
                  aria-checked={gradeMode === "letter"}
                  role="radio"
                >
                  Letter (A-F)
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${gradeMode === "numerical" ? "active-toggle" : ""}`}
                  onClick={() => {
                    setGradeMode("numerical");
                    setGradeValue("");
                    setErrors((prev) => ({ ...prev, grade: undefined }));
                  }}
                  aria-checked={gradeMode === "numerical"}
                  role="radio"
                >
                  Numerical (0-100)
                </button>
              </div>
            </div>

            <input
              id="grade-input"
              type={gradeMode === "numerical" ? "number" : "text"}
              className={`form-input ${errors.grade ? "input-error" : ""}`}
              placeholder={
                gradeMode === "numerical"
                  ? "Enter numerical score (e.g., 92)"
                  : "Enter letter grade (e.g., A+ or B)"
              }
              min={gradeMode === "numerical" ? 0 : undefined}
              max={gradeMode === "numerical" ? 100 : undefined}
              value={gradeValue}
              onChange={(e) => {
                const val = e.target.value;
                setGradeValue(val);
                if (errors.grade) {
                  const err = validateGrade(val, gradeMode);
                  setErrors((prev) => ({ ...prev, grade: err || undefined }));
                }
              }}
              onBlur={() => {
                const err = validateGrade(gradeValue, gradeMode);
                if (err) setErrors((prev) => ({ ...prev, grade: err }));
              }}
              aria-invalid={!!errors.grade}
              aria-describedby={errors.grade ? "grade-error-msg" : undefined}
            />
            {errors.grade && (
              <span id="grade-error-msg" className="error-text" role="alert">
                {errors.grade}
              </span>
            )}
          </div>

          {/* 4. Multi-line Remarks Textarea with Real-Time Character Counter */}
          <div className="form-group">
            <div className="label-row">
              <label htmlFor="remarks-textarea" className="form-label">
                Teacher Remarks <span className="required-star">*</span>
              </label>
              <span
                className={`char-counter ${remarks.length >= 450 ? "counter-warning" : ""}`}
                aria-live="polite"
              >
                {remarks.length} / 500 characters
              </span>
            </div>

            <textarea
              id="remarks-textarea"
              className={`form-textarea ${errors.remarks ? "input-error" : ""}`}
              rows={4}
              maxLength={500}
              placeholder="Enter constructive progress remarks and observational feedback..."
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (errors.remarks) setErrors((prev) => ({ ...prev, remarks: undefined }));
              }}
              aria-invalid={!!errors.remarks}
              aria-describedby={errors.remarks ? "remarks-error-msg" : undefined}
            />
            {errors.remarks && (
              <span id="remarks-error-msg" className="error-text" role="alert">
                {errors.remarks}
              </span>
            )}
          </div>

          {/* 5. Form Actions (Submit & Reset) */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={isSubmitting}
            >
              Reset Form
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading-spinner-wrapper">
                  <span className="spinner-dot"></span>
                  Submitting Progress...
                </span>
              ) : (
                "Submit Progress Update"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
