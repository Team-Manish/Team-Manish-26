import { useState, useEffect, useCallback } from "react";
import {
  getAttendanceHeatmap,
  getDailyAttendanceDetails,
  getClassList,
} from "../services/attendanceService";
import "./AttendanceHeatmap.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const AttendanceHeatmap = ({ userRole = "admin", initialClass = "Grade 10-A" }) => {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1); // 1-12
  
  // Task-4: Admin View Toggle State (School vs Class)
  const [viewMode, setViewMode] = useState(userRole === "admin" ? "school" : "class");
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [availableClasses, setAvailableClasses] = useState([
    "Grade 10-A", "Grade 10-B", "Grade 11-A", "Computer Science 101"
  ]);

  // Data & State
  const [heatmapData, setHeatmapData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Task-3: Interactivity & Tooltip State
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Task-3: Modal State for Day Details Click
  const [selectedDayModal, setSelectedDayModal] = useState(null);
  const [dailyDetails, setDailyDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // Load available class list on mount
  useEffect(() => {
    let isMounted = true;
    getClassList()
      .then((res) => {
        if (!isMounted) return;
        if (res?.classes?.length) {
          setAvailableClasses(res.classes);
          setSelectedClass((prev) => (res.classes.includes(prev) ? prev : res.classes[0]));
        }
      })
      .catch((err) => console.warn("Failed to load class list:", err.message));
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Heatmap Data from Backend Aggregation Endpoint (Task-2 & Task-4)
  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAttendanceHeatmap({
        year,
        month,
        viewMode,
        className: selectedClass,
      });

      if (data.success) {
        setHeatmapData(data.dailyData || []);
        setSummary(data.summary || null);
        if (data.meta?.availableClasses?.length) {
          setAvailableClasses(data.meta.availableClasses);
        }
      } else {
        setError(data.message || "Failed to load heatmap data");
      }
    } catch (err) {
      setError(err.message || "Error loading attendance heatmap");
    } finally {
      setLoading(false);
    }
  }, [year, month, viewMode, selectedClass]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
  };

  // Build Calendar Days for Month
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun

  const calendarCells = [];
  // Add leading empty padding cells for month offset
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ empty: true, id: `empty-${i}` });
  }

  // Map API daily data by date string YYYY-MM-DD
  const dailyDataMap = (heatmapData || []).reduce((acc, curr) => {
    acc[curr.date] = curr;
    return acc;
  }, {});

  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = String(day).padStart(2, "0");
    const formattedMonth = String(month).padStart(2, "0");
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const data = dailyDataMap[dateStr] || null;

    calendarCells.push({
      empty: false,
      dayNumber: day,
      dateStr,
      isWeekend,
      data,
    });
  }

  // Helper for shading cell based on attendance rate (Task-1)
  const getShadingClass = (cell) => {
    if (cell.isWeekend) return "cell-shaded-weekend";
    if (!cell.data || cell.data.totalStudents === 0) return "cell-shaded-nodata";

    const rate = cell.data.attendanceRate;
    if (rate >= 95) return "cell-shaded-95";
    if (rate >= 85) return "cell-shaded-85";
    if (rate >= 75) return "cell-shaded-75";
    return "cell-shaded-low";
  };

  // Tooltip Handlers (Task-3)
  const handleMouseEnterCell = (e, cell) => {
    if (cell.empty || cell.isWeekend || !cell.data) {
      setHoveredDay(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setHoveredDay(cell);
  };

  const handleMouseLeaveCell = () => {
    setHoveredDay(null);
  };

  // Day Click Handler for Detailed Modal (Task-3)
  const handleDayClick = async (cell) => {
    if (cell.empty || cell.isWeekend || !cell.data) return;
    setSelectedDayModal(cell);
    setLoadingDetails(true);
    setStatusFilter("all");
    try {
      const res = await getDailyAttendanceDetails({
        date: cell.dateStr,
        viewMode,
        className: selectedClass,
      });
      if (res.success) {
        setDailyDetails(res.records || []);
      }
    } catch (err) {
      console.error("Failed to load daily attendance details:", err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredDetails = dailyDetails.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  return (
    <div className="heatmap-container" aria-label="Interactive Attendance Heatmap">
      {/* Top Header & Task-4 Controls */}
      <div className="heatmap-header">
        <div className="heatmap-title-area">
          <h2>
            <span>📅</span> Student Attendance Heatmap
          </h2>
          <p className="heatmap-subtitle">
            Visualizing daily attendance patterns and aggregate metrics for {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>

        <div className="heatmap-controls">
          {/* Task-4: Admin Toggle UI between School-Wide and Class View */}
          {userRole === "admin" && (
            <div className="view-toggle-group" role="radiogroup" aria-label="Heatmap View Mode">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "school" ? "active" : ""}`}
                onClick={() => setViewMode("school")}
              >
                🏫 School-Wide
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "class" ? "active" : ""}`}
                onClick={() => setViewMode("class")}
              >
                📚 Class View
              </button>
            </div>
          )}

          {/* Class Select Dropdown */}
          {(viewMode === "class" || userRole === "teacher") && (
            <select
              className="class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              aria-label="Select Class"
            >
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          )}

          {/* Month Picker Controls */}
          <div className="month-picker-controls">
            <button
              type="button"
              className="month-nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
              aria-label="Previous Month"
            >
              ‹
            </button>
            <span className="current-month-display">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              type="button"
              className="month-nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
              aria-label="Next Month"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {summary && (
        <div className="heatmap-summary-cards">
          <div className="summary-card">
            <span className="summary-label">Attendance Rate</span>
            <div
              className={`summary-value ${
                summary.overallAttendanceRate >= 90
                  ? "rate-high"
                  : summary.overallAttendanceRate >= 80
                  ? "rate-good"
                  : summary.overallAttendanceRate >= 70
                  ? "rate-medium"
                  : "rate-low"
              }`}
            >
              {summary.overallAttendanceRate}%
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Scope</span>
            <div className="summary-value" style={{ fontSize: "1.1rem" }}>
              {viewMode === "school" ? "🏫 School-Wide" : `📚 ${selectedClass}`}
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Present</span>
            <div className="summary-value rate-high">{summary.totalPresent}</div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Absent</span>
            <div className="summary-value rate-low">{summary.totalAbsent}</div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Late</span>
            <div className="summary-value rate-medium">{summary.totalLate}</div>
          </div>
        </div>
      )}

      {/* Error & Loading States */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          🔄 Aggregating attendance records from MongoDB...
        </div>
      ) : error ? (
        <div className="dashboard-alert alert-error" role="alert">
          {error}
        </div>
      ) : (
        <div className="calendar-heatmap-wrapper">
          {/* Calendar Heatmap Grid Layout (Task-1) */}
          <div className="calendar-grid">
            {WEEKDAY_NAMES.map((w) => (
              <div key={w} className="weekday-header">
                {w}
              </div>
            ))}

            {calendarCells.map((cell, idx) => {
              if (cell.empty) {
                return <div key={cell.id} className="heatmap-cell empty-cell" />;
              }

              const shadingClass = getShadingClass(cell);

              return (
                <div
                  key={cell.dateStr || idx}
                  className={`heatmap-cell ${shadingClass}`}
                  onMouseEnter={(e) => handleMouseEnterCell(e, cell)}
                  onMouseLeave={handleMouseLeaveCell}
                  onClick={() => handleDayClick(cell)}
                  tabIndex={cell.data ? 0 : -1}
                  role="button"
                  aria-label={
                    cell.data
                      ? `Date ${cell.dateStr}: ${cell.data.attendanceRate}% Attendance`
                      : `Date ${cell.dateStr}: No data`
                  }
                >
                  <span className="cell-day-number">{cell.dayNumber}</span>
                  {cell.data && cell.data.totalStudents > 0 && (
                    <span className="cell-rate-badge">{cell.data.attendanceRate}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Hover Tooltip (Task-3) */}
      {hoveredDay && hoveredDay.data && (
        <div
          className="heatmap-tooltip"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            position: "fixed",
          }}
        >
          <div className="tooltip-date">
            📅 {new Date(hoveredDay.dateStr).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="tooltip-row">
            <span>Attendance Rate:</span>
            <span className="tooltip-value" style={{ color: "#34d399" }}>
              {hoveredDay.data.attendanceRate}%
            </span>
          </div>
          <div className="tooltip-row">
            <span>Present:</span>
            <span className="tooltip-value">{hoveredDay.data.present}</span>
          </div>
          <div className="tooltip-row">
            <span>Absent:</span>
            <span className="tooltip-value">{hoveredDay.data.absent}</span>
          </div>
          <div className="tooltip-row">
            <span>Late:</span>
            <span className="tooltip-value">{hoveredDay.data.late}</span>
          </div>
          <div className="tooltip-row">
            <span>Total Students:</span>
            <span className="tooltip-value">{hoveredDay.data.totalStudents}</span>
          </div>
          <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "#9ca3af", fontStyle: "italic" }}>
            Click cell to view detailed student roster
          </div>
        </div>
      )}

      {/* Color Legend (Task-1) */}
      <div className="heatmap-legend">
        <span>Attendance Rate Range:</span>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: "#10b981" }} />
            <span>≥ 95%</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: "#34d399" }} />
            <span>85% - 94%</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: "#fbbf24" }} />
            <span>75% - 84%</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: "#f87171" }} />
            <span>&lt; 75%</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: "#f3f4f6", border: "1px solid #d1d5db" }} />
            <span>Weekend / No Data</span>
          </div>
        </div>
      </div>

      {/* Interactive Day Details Modal (Task-3) */}
      {selectedDayModal && (
        <div className="modal-overlay" onClick={() => setSelectedDayModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  📋 Attendance Breakdown for {selectedDayModal.dateStr}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  Scope: {viewMode === "school" ? "School-Wide" : selectedClass} | Attendance Rate:{" "}
                  <strong>{selectedDayModal.data?.attendanceRate}%</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedDayModal(null)}
              >
                ✕
              </button>
            </div>

            {/* Filter buttons */}
            <div style={{ display: "flex", gap: "8px", margin: "12px 0" }}>
              {["all", "present", "absent", "late", "excused"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    textTransform: "capitalize",
                    background:
                      statusFilter === status
                        ? "var(--color-primary)"
                        : "var(--color-bg-page)",
                    color: statusFilter === status ? "#fff" : "var(--color-text-main)",
                    cursor: "pointer",
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            {loadingDetails ? (
              <p style={{ padding: "20px", textAlign: "center" }}>Loading student records...</p>
            ) : filteredDetails.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)" }}>
                No student records matching status filter '{statusFilter}'.
              </p>
            ) : (
              <table className="modal-body-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((rec) => (
                    <tr key={rec._id || rec.studentId}>
                      <td style={{ fontWeight: "600" }}>{rec.studentId}</td>
                      <td>{rec.studentName}</td>
                      <td>{rec.className}</td>
                      <td>
                        <span className={`badge-status badge-${rec.status}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                        {rec.remarks || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHeatmap;
