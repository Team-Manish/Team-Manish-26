import React, { useState, useMemo, useRef, useEffect } from "react";
import "./StudentSelector.css";

export default function StudentSelector({
  students = [],
  selectedStudent = null,
  onSelectStudent,
  isLoading = false,
  placeholder = "Search or select a student...",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sync search input when selectedStudent changes externally
  useEffect(() => {
    if (selectedStudent) {
      setSearchQuery(selectedStudent.name || selectedStudent.studentId || "");
    } else {
      setSearchQuery("");
    }
  }, [selectedStudent]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter students by name, ID, or email
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim() || (selectedStudent && searchQuery === selectedStudent.name)) {
      return students;
    }
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const id = (s.studentId || s.id || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      return name.includes(q) || id.includes(q) || email.includes(q);
    });
  }, [searchQuery, students, selectedStudent]);

  const handleSelect = (student) => {
    if (onSelectStudent) {
      onSelectStudent(student);
    }
    setSearchQuery(student.name || student.studentId);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearchQuery("");
    if (onSelectStudent) {
      onSelectStudent(null);
    }
    setIsOpen(false);
  };

  return (
    <div className="student-selector-container" ref={dropdownRef}>
      <label htmlFor="student-select-input" className="selector-label">
        👤 Select Student for Academic Progress View
      </label>

      <div className="selector-input-wrapper">
        <input
          id="student-select-input"
          type="text"
          className="selector-input"
          placeholder={isLoading ? "Loading student roster..." : placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={isLoading}
          autoComplete="off"
        />

        <div className="selector-actions">
          {selectedStudent && (
            <button
              type="button"
              className="clear-selection-btn"
              onClick={handleClear}
              title="Clear selection"
              aria-label="Clear selected student"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className="dropdown-toggle-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle student dropdown"
          >
            {isOpen ? "▲" : "▼"}
          </button>
        </div>

        {isOpen && (
          <ul className="student-dropdown-menu" role="listbox">
            {isLoading ? (
              <li className="dropdown-loading-item">Loading class roster...</li>
            ) : filteredStudents.length === 0 ? (
              <li className="dropdown-empty-item">
                No students match "{searchQuery}"
              </li>
            ) : (
              filteredStudents.map((student) => {
                const studentId = student.studentId || student.id || student._id;
                const isSelected = selectedStudent && (selectedStudent.studentId === studentId || selectedStudent.id === studentId || selectedStudent._id === studentId);

                return (
                  <li
                    key={studentId}
                    className={`student-dropdown-item ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSelect(student)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="item-avatar">
                      {(student.name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="item-info">
                      <span className="item-name">{student.name}</span>
                      <span className="item-details">
                        ID: {studentId} | {student.email || "Enrolled Student"}
                      </span>
                    </div>
                    {isSelected && <span className="item-check">✓</span>}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
