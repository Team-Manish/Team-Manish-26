import React, { useState, useEffect, useCallback, useMemo } from "react";
import StudentSelector from "./StudentSelector";
import StudentProgressChart from "./StudentProgressChart";
import { getStudentProgressHistory } from "../services/progressService";
import { getStudents } from "../services/studentService";
import "./StudentProgressWidget.css";

// Fallback initial roster if backend is loading or standalone
const DEMO_ROSTER = [
  {
    studentId: "STU-1001",
    name: "Alex Smith",
    email: "alex.smith@school.edu",
    enrolledSubjects: ["Computer Science Foundations", "Advanced Mathematics", "Physics"],
  },
  {
    studentId: "STU-1002",
    name: "Emma Watson",
    email: "emma.watson@school.edu",
    enrolledSubjects: ["Biology", "Chemistry", "English Literature"],
  },
  {
    studentId: "STU-1003",
    name: "Liam Johnson",
    email: "liam.johnson@school.edu",
    enrolledSubjects: ["Advanced Mathematics", "Physics", "Chemistry"],
  },
  {
    studentId: "STU-1004",
    name: "Sophia Martinez",
    email: "sophia.martinez@school.edu",
    enrolledSubjects: ["Computer Science Foundations", "English Literature", "History"],
  },
];

export default function StudentProgressWidget({ initialStudentId = null }) {
  const [students, setStudents] = useState(DEMO_ROSTER);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  
  const [progressRecords, setProgressRecords] = useState([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [progressError, setProgressError] = useState("");

  // 1. Fetch Students Roster from Backend
  useEffect(() => {
    let isMounted = true;
    setIsLoadingRoster(true);

    getStudents()
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((s) => ({
            studentId: s.studentId || s.id || s._id,
            name: s.name,
            email: s.email,
            enrolledSubjects: s.enrolledSubjects || ["General Studies"],
          }));
          setStudents(formatted);
          // Preselect first student if initialStudentId matches or default
          const defaultSub = formatted.find(
            (st) => st.studentId === initialStudentId
          ) || formatted[0];
          setSelectedStudent(defaultSub);
        } else {
          setSelectedStudent(DEMO_ROSTER[0]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("Using demo roster fallback:", err.message);
        setSelectedStudent(DEMO_ROSTER[0]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRoster(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialStudentId]);

  // 2. Fetch Progress History when Selected Student changes
  const fetchProgressForStudent = useCallback(async (student) => {
    if (!student) {
      setProgressRecords([]);
      return;
    }

    const sId = student.studentId || student.id || student._id;
    setIsLoadingProgress(true);
    setProgressError("");

    try {
      const records = await getStudentProgressHistory(sId);
      setProgressRecords(records || []);
    } catch (err) {
      setProgressError(err.message || "Failed to load student progress data.");
      setProgressRecords([]);
    } finally {
      setIsLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      setSelectedSubjectFilter("all");
      fetchProgressForStudent(selectedStudent);
    }
  }, [selectedStudent, fetchProgressForStudent]);

  // 3. Extract unique subjects for subject filter pills
  const availableSubjects = useMemo(() => {
    if (!progressRecords || progressRecords.length === 0) return [];
    const set = new Set();
    progressRecords.forEach((r) => {
      if (r.subject) set.add(r.subject);
    });
    return Array.from(set);
  }, [progressRecords]);

  // 4. Compute Summary Metrics (Average Score, Latest Grade, Trend)
  const summaryMetrics = useMemo(() => {
    if (!progressRecords || progressRecords.length === 0) return null;

    const filtered = selectedSubjectFilter === "all"
      ? progressRecords
      : progressRecords.filter(
          (r) => r.subject && r.subject.toLowerCase() === selectedSubjectFilter.toLowerCase()
        );

    if (filtered.length === 0) return null;

    const scores = filtered.map((r) => {
      if (typeof r.score === "number") return r.score;
      if (typeof r.grade === "number") return r.grade;
      const p = parseFloat(r.grade);
      return !isNaN(p) ? p : r.overallCompletionPercentage || 0;
    });

    const sum = scores.reduce((a, b) => a + b, 0);
    const avgScore = (sum / scores.length).toFixed(1);

    const sorted = [...filtered].sort(
      (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
    );

    const latest = sorted[sorted.length - 1];
    const latestScore = typeof latest.score === "number"
      ? latest.score
      : typeof latest.grade === "number"
      ? latest.grade
      : parseFloat(latest.grade) || 0;

    let trendPercent = 0;
    if (scores.length >= 2) {
      const firstScore = scores[0];
      const lastScore = scores[scores.length - 1];
      trendPercent = (lastScore - firstScore).toFixed(1);
    }

    return {
      avgScore,
      latestScore,
      latestSubject: latest.subject,
      totalCount: filtered.length,
      trendPercent,
    };
  }, [progressRecords, selectedSubjectFilter]);

  return (
    <div className="progress-widget-wrapper">
      {/* Widget Header Controls & Selector */}
      <div className="widget-control-panel">
        <div className="selector-section">
          <StudentSelector
            students={students}
            selectedStudent={selectedStudent}
            onSelectStudent={(st) => setSelectedStudent(st)}
            isLoading={isLoadingRoster}
          />
        </div>

        {/* Subject Filter Pills */}
        {availableSubjects.length > 0 && (
          <div className="subject-pills-container" role="tablist" aria-label="Subject Filter">
            <span className="pills-label">Filter Subject:</span>
            <button
              type="button"
              className={`pill-btn ${selectedSubjectFilter === "all" ? "active-pill" : ""}`}
              onClick={() => setSelectedSubjectFilter("all")}
            >
              All Subjects
            </button>
            {availableSubjects.map((sub) => (
              <button
                key={sub}
                type="button"
                className={`pill-btn ${selectedSubjectFilter.toLowerCase() === sub.toLowerCase() ? "active-pill" : ""}`}
                onClick={() => setSelectedSubjectFilter(sub)}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      {selectedStudent && summaryMetrics && (
        <div className="kpi-cards-grid">
          <div className="kpi-card">
            <span className="kpi-icon">📊</span>
            <div className="kpi-data">
              <span className="kpi-title">Average Performance</span>
              <span className="kpi-value">{summaryMetrics.avgScore}%</span>
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-icon">🎯</span>
            <div className="kpi-data">
              <span className="kpi-title">Latest Score</span>
              <span className="kpi-value">{summaryMetrics.latestScore}%</span>
              <span className="kpi-subtext">{summaryMetrics.latestSubject}</span>
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-icon">📝</span>
            <div className="kpi-data">
              <span className="kpi-title">Total Assessments</span>
              <span className="kpi-value">{summaryMetrics.totalCount}</span>
            </div>
          </div>

          <div className="kpi-card">
            <span className="kpi-icon">
              {Number(summaryMetrics.trendPercent) >= 0 ? "📈" : "📉"}
            </span>
            <div className="kpi-data">
              <span className="kpi-title">Progress Trajectory</span>
              <span
                className={`kpi-value ${
                  Number(summaryMetrics.trendPercent) >= 0 ? "trend-up" : "trend-down"
                }`}
              >
                {Number(summaryMetrics.trendPercent) >= 0 ? "+" : ""}
                {summaryMetrics.trendPercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Line Chart Display */}
      <StudentProgressChart
        records={progressRecords}
        selectedSubject={selectedSubjectFilter}
        isLoading={isLoadingProgress}
        error={progressError}
        studentName={selectedStudent ? selectedStudent.name : ""}
      />
    </div>
  );
}
