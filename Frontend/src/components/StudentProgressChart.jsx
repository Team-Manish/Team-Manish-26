import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "./StudentProgressChart.css";

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Distinct accessible color palette for subjects
const SUBJECT_COLORS = [
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" }, // Blue
  { border: "#10b981", bg: "rgba(16, 185, 129, 0.15)" }, // Emerald
  { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)" }, // Purple
  { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" }, // Amber
  { border: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" }, // Pink
  { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)" },  // Cyan
  { border: "#f97316", bg: "rgba(249, 115, 22, 0.15)" }, // Orange
];

export default function StudentProgressChart({
  records = [],
  selectedSubject = "all",
  isLoading = false,
  error = "",
  studentName = "",
}) {
  // 1. Process & Format Chart Data Points
  const chartData = useMemo(() => {
    if (!records || records.length === 0) return null;

    // Filter by selected subject if specified
    const filteredRecords = selectedSubject === "all"
      ? records
      : records.filter(
          (r) => r.subject && r.subject.toLowerCase() === selectedSubject.toLowerCase()
        );

    if (filteredRecords.length === 0) return null;

    // Sort chronologically by date
    const sorted = [...filteredRecords].sort(
      (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
    );

    // Format dates for X-axis labels
    const dateLabels = Array.from(
      new Set(
        sorted.map((r) => {
          const d = new Date(r.date || r.createdAt);
          return isNaN(d.getTime())
            ? "Unknown Date"
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        })
      )
    );

    // Handle single subject vs all subjects dataset layout
    if (selectedSubject !== "all") {
      // Single line view with gradient fill
      const scores = sorted.map((r) => {
        if (typeof r.score === "number") return r.score;
        if (typeof r.grade === "number") return r.grade;
        const parsed = parseFloat(r.grade);
        return !isNaN(parsed) ? parsed : r.overallCompletionPercentage || 0;
      });

      return {
        labels: dateLabels,
        datasets: [
          {
            label: `${selectedSubject} Score (%)`,
            data: scores,
            borderColor: "#3b82f6",
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 300);
              gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
              gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");
              return gradient;
            },
            fill: true,
            tension: 0.35,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
          },
        ],
      };
    }

    // Multi-subject comparison datasets
    const subjectsMap = {};
    sorted.forEach((r) => {
      const subName = r.subject || "General";
      if (!subjectsMap[subName]) subjectsMap[subName] = [];
      const score = typeof r.score === "number"
        ? r.score
        : typeof r.grade === "number"
        ? r.grade
        : !isNaN(parseFloat(r.grade))
        ? parseFloat(r.grade)
        : r.overallCompletionPercentage || 0;
      subjectsMap[subName].push(score);
    });

    const datasets = Object.keys(subjectsMap).map((subName, idx) => {
      const colors = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
      return {
        label: subName,
        data: subjectsMap[subName],
        borderColor: colors.border,
        backgroundColor: colors.bg,
        fill: false,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: colors.border,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      };
    });

    return {
      labels: dateLabels,
      datasets,
    };
  }, [records, selectedSubject]);

  // 2. Chart Layout Options & Axes Config
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: {
              family: "Inter, system-ui, sans-serif",
              size: 12,
              weight: "600",
            },
            padding: 16,
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleFont: { family: "Inter", size: 13, weight: "bold" },
          bodyFont: { family: "Inter", size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const val = context.parsed.y;
              return ` ${label}: ${val}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: { family: "Inter", size: 11 },
            color: "#64748b",
          },
          title: {
            display: true,
            text: "Assessment Period / Date",
            font: { family: "Inter", size: 12, weight: "500" },
            color: "#94a3b8",
          },
        },
        y: {
          min: 0,
          max: 100,
          grid: {
            color: "rgba(226, 232, 240, 0.6)",
            strokeDash: [4, 4],
          },
          ticks: {
            stepSize: 20,
            callback: (val) => `${val}%`,
            font: { family: "Inter", size: 11 },
            color: "#64748b",
          },
          title: {
            display: true,
            text: "Academic Grade Score (%)",
            font: { family: "Inter", size: 12, weight: "500" },
            color: "#94a3b8",
          },
        },
      },
    }),
    []
  );

  return (
    <div className="chart-wrapper-card">
      <div className="chart-header">
        <div className="chart-title-area">
          <h3>
            📈 {studentName ? `${studentName}'s Progress Trend` : "Student Progress Trend"}
          </h3>
          <p className="chart-subtitle">
            {selectedSubject === "all"
              ? "Displaying score evolution across all enrolled subjects over time"
              : `Tracking performance trajectory for ${selectedSubject}`}
          </p>
        </div>

        {selectedSubject !== "all" && (
          <span className="active-subject-badge">{selectedSubject}</span>
        )}
      </div>

      <div className="chart-canvas-container">
        {isLoading ? (
          <div className="chart-loading-state" role="status">
            <div className="chart-spinner"></div>
            <p>Fetching student academic records from database...</p>
          </div>
        ) : error ? (
          <div className="chart-error-state" role="alert">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        ) : !chartData ? (
          <div className="chart-empty-state">
            <span className="empty-icon">📊</span>
            <h4>No Academic Records Available</h4>
            <p>
              Select a student from the dropdown or update progress entries to plot performance trends.
            </p>
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
