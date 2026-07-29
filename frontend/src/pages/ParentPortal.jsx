import { useState, useEffect, useMemo, useRef } from 'react';
import { attendanceAPI, progressAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import ParentNav from '../components/ParentNav';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
);

const EXAM_TYPES = ['all', 'quiz', 'assignment', 'midterm', 'final', 'project', 'homework', 'other'];

const gradeColors = {
  'A+': '#16a34a', A: '#22c55e', 'B+': '#3b82f6', B: '#60a5fa',
  C: '#f59e0b', D: '#f97316', F: '#ef4444',
};

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
    </div>
  );
}

function SubjectBarChart({ data }) {
  if (!data?.length) return null;
  return (
    <Bar
      data={{
        labels: data.map((s) => s.subject),
        datasets: [{
          label: 'Average Score (%)',
          data: data.map((s) => s.percentage),
          backgroundColor: data.map((s) =>
            s.percentage >= 80 ? '#22c55e' : s.percentage >= 60 ? '#f59e0b' : '#ef4444'
          ),
          borderRadius: 6,
          barThickness: 40,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y}% avg (${data[ctx.dataIndex].totalExams} exams)`,
            },
          },
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { grid: { display: false } },
        },
      }}
    />
  );
}

function GradeDoughnutChart({ data }) {
  if (!data?.length) return null;
  const labels = ['F (0-39)', 'D (40-59)', 'C (60-74)', 'B (75-89)', 'A (90-100)'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'];
  const counts = [0, 0, 0, 0, 0];
  data.forEach((d) => {
    if (d.range < 40) counts[0] += d.count;
    else if (d.range < 60) counts[1] += d.count;
    else if (d.range < 75) counts[2] += d.count;
    else if (d.range < 90) counts[3] += d.count;
    else counts[4] += d.count;
  });

  return (
    <Doughnut
      data={{
        labels,
        datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
        },
        cutout: '55%',
      }}
    />
  );
}

function ScoreTrendChart({ records }) {
  if (!records?.length) return null;
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  return (
    <Line
      data={{
        labels: sorted.map((r) => new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
        datasets: [{
          label: 'Score %',
          data: sorted.map((r) => Math.round((r.score / r.maxScore) * 100)),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#4f46e5',
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
        },
      }}
    />
  );
}

function getAttendanceDoughnut(attendance) {
  if (!attendance?.summary?.length) return null;
  const labels = ['Present', 'Absent', 'Late', 'Excused'];
  const totals = [0, 0, 0, 0];
  attendance.summary.forEach((s) => {
    s.records.forEach((r) => {
      const idx = labels.findIndex((l) => l.toLowerCase() === r.status);
      if (idx >= 0) totals[idx] += r.count;
    });
  });
  return {
    labels,
    datasets: [{
      data: totals,
      backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };
}

function OverviewTab({ analytics, attendance, chartRef }) {
  const attPercentage = useMemo(() => {
    if (!attendance?.summary) return 'N/A';
    const totalPresent = attendance.summary.reduce((a, s) => {
      const p = s.records.find((r) => r.status === 'present');
      return a + (p?.count || 0);
    }, 0);
    const totalDays = attendance.summary.reduce((a, s) => a + s.totalDays, 0);
    return `${Math.round((totalPresent / Math.max(totalDays, 1)) * 100)}%`;
  }, [attendance]);

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Overall Score" value={`${analytics.overallPercentage}%`} color="#4f46e5" />
        <StatCard label="Subjects" value={analytics.subjectAverages.length} color="#3b82f6" />
        <StatCard label="Total Exams" value={analytics.totalRecords} color="#8b5cf6" />
        <StatCard label="Attendance" value={attPercentage} color="#22c55e" />
      </div>

      <div className="section" ref={chartRef}>
        <h2>Subject Performance</h2>
        <div className="chart-grid">
          <div className="chart-container">
            <h3>Subject-wise Averages</h3>
            <div style={{ height: 300 }}>
              <SubjectBarChart data={analytics.subjectAverages} />
            </div>
          </div>
          <div className="chart-container">
            <h3>Grade Distribution</h3>
            <div style={{ height: 300 }}>
              <GradeDoughnutChart data={analytics.gradeDistribution} />
            </div>
          </div>
        </div>
      </div>

      {attendance?.summary && (
        <div className="section">
          <h2>Attendance Overview (Last 90 Days)</h2>
          <div className="chart-container" style={{ maxWidth: 400 }}>
            <Doughnut
              data={getAttendanceDoughnut(attendance)}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
                cutout: '55%',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function AttendanceTab({ attendance, chartRef }) {
  if (!attendance?.summary?.length) {
    return <div className="empty-state">No attendance data available.</div>;
  }

  const attDoughnut = getAttendanceDoughnut(attendance);
  const totalDays = attendance.summary.reduce((a, s) => a + s.totalDays, 0);
  const statusCounts = { present: 0, absent: 0, late: 0, excused: 0 };
  attendance.summary.forEach((s) => {
    s.records.forEach((r) => {
      if (statusCounts[r.status] !== undefined) statusCounts[r.status] += r.count;
    });
  });

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total Days" value={totalDays} color="#4f46e5" />
        <StatCard label="Present" value={statusCounts.present} color="#22c55e" />
        <StatCard label="Absent" value={statusCounts.absent} color="#ef4444" />
        <StatCard label="Late" value={statusCounts.late} color="#f59e0b" />
      </div>

      <div className="section" ref={chartRef}>
        <h2>Attendance Breakdown</h2>
        <div className="chart-grid">
          <div className="chart-container">
            <h3>Status Distribution</h3>
            <div style={{ height: 300 }}>
              {attDoughnut && (
                <Doughnut
                  data={attDoughnut}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } },
                    cutout: '55%',
                  }}
                />
              )}
            </div>
          </div>
          <div className="chart-container">
            <h3>Monthly Attendance</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Days</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.summary.map((s, i) => {
                    const present = s.records.find((r) => r.status === 'present')?.count || 0;
                    const rate = Math.round((present / Math.max(s.totalDays, 1)) * 100);
                    return (
                      <tr key={i}>
                        <td>{new Date(s._id?.date || s.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
                        <td>{s.totalDays}</td>
                        <td><span className="status-badge present">{present}</span></td>
                        <td><span className="status-badge absent">{s.totalDays - present}</span></td>
                        <td><strong>{rate}%</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProgressTab({ progressData, filteredRecords, subjects, subjectFilter, setSubjectFilter, examFilter, setExamFilter, chartRef }) {
  const { analytics } = progressData;

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Overall Score" value={`${analytics.overallPercentage}%`} color="#4f46e5" />
        <StatCard label="Subjects" value={analytics.subjectAverages.length} color="#3b82f6" />
        <StatCard label="Total Exams" value={analytics.totalRecords} color="#8b5cf6" />
      </div>

      <div className="section" ref={chartRef}>
        <h2>Subject Performance</h2>
        <div className="chart-grid">
          <div className="chart-container">
            <h3>Subject-wise Averages</h3>
            <div style={{ height: 300 }}>
              <SubjectBarChart data={analytics.subjectAverages} />
            </div>
          </div>
          <div className="chart-container">
            <h3>Grade Distribution</h3>
            <div style={{ height: 300 }}>
              <GradeDoughnutChart data={analytics.gradeDistribution} />
            </div>
          </div>
        </div>
      </div>

      {filteredRecords.length > 0 && (
        <div className="section">
          <h2>Score Trend</h2>
          <div className="chart-container">
            <div style={{ height: 250 }}>
              <ScoreTrendChart records={filteredRecords} />
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h2>Progress Records</h2>
          <div className="filter-row">
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Remarks</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan="7" className="empty-row">No records found</td></tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r._id}>
                    <td>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><span className="subject-tag">{r.subject}</span></td>
                    <td><span className="exam-badge">{r.examType}</span></td>
                    <td><strong>{r.score}</strong>/{r.maxScore}</td>
                    <td>
                      <span className="grade-pill" style={{ background: gradeColors[r.grade] || '#6b7280' }}>{r.grade}</span>
                    </td>
                    <td className="remarks-cell">{r.remarks || '-'}</td>
                    <td>{r.recordedBy?.name || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function ParentPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [attendance, setAttendance] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        const progRes = await progressAPI.getParentChild().catch(() => ({ data: { data: null } }));
        const progress = progRes.data.data;
        setProgressData(progress);

        if (progress?.student?.id) {
          const attRes = await attendanceAPI.getStudentAttendance(progress.student.id, {
            startDate: threeMonthsAgo,
            endDate: today,
          }).catch(() => ({ data: { data: null } }));
          setAttendance(attRes.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const filteredRecords = useMemo(() => {
    if (!progressData?.records) return [];
    return progressData.records.filter((r) => {
      if (subjectFilter !== 'all' && r.subject !== subjectFilter) return false;
      if (examFilter !== 'all' && r.examType !== examFilter) return false;
      return true;
    });
  }, [progressData, subjectFilter, examFilter]);

  const subjects = useMemo(() => {
    if (!progressData?.analytics?.subjectAverages) return [];
    return progressData.analytics.subjectAverages.map((s) => s.subject);
  }, [progressData]);

  const getTabExportData = () => {
    if (activeTab === 'overview' || activeTab === 'progress') {
      if (!progressData?.records) return { headers: [], rows: [] };
      const headers = ['Date', 'Subject', 'Type', 'Score', 'Max Score', 'Grade', 'Remarks'];
      const rows = filteredRecords.map((r) => [
        new Date(r.date).toLocaleDateString('en-IN'),
        r.subject,
        r.examType,
        r.score,
        r.maxScore,
        r.grade,
        r.remarks || '-',
      ]);
      return { headers, rows };
    }
    if (activeTab === 'attendance') {
      if (!attendance?.summary) return { headers: [], rows: [] };
      const headers = ['Period', 'Total Days', 'Present', 'Absent', 'Rate'];
      const rows = attendance.summary.map((s) => {
        const present = s.records.find((r) => r.status === 'present')?.count || 0;
        return [
          new Date(s._id?.date || s.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          s.totalDays,
          present,
          s.totalDays - present,
          `${Math.round((present / Math.max(s.totalDays, 1)) * 100)}%`,
        ];
      });
      return { headers, rows };
    }
    return { headers: [], rows: [] };
  };

  const handleExportPDF = () => {
    const studentName = progressData?.student
      ? `${progressData.student.firstName} ${progressData.student.lastName}`
      : 'Unknown';
    const { headers, rows } = getTabExportData();
    const canvases = chartRef.current
      ? Array.from(chartRef.current.querySelectorAll('canvas'))
      : [];
    const tabTitles = { overview: 'Overview', attendance: 'Attendance', progress: 'Progress' };
    generatePDF({
      title: `Child Report - ${studentName}`,
      subtitle: `Tab: ${tabTitles[activeTab] || activeTab} | Roll No: ${progressData?.student?.rollNumber || '-'}`,
      headers,
      rows,
      chartCanvases: canvases,
      filename: `edutrack-child-report-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getTabExportData();
    generateCSV(headers, rows, `edutrack-child-report-${new Date().toISOString().split('T')[0]}`);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!progressData?.student) {
    return (
      <div className="page">
        <ParentNav activeTab={activeTab} onTabChange={setActiveTab} />
        <h1>My Child</h1>
        <div className="empty-state">No child record linked to your account. Contact your school administrator.</div>
      </div>
    );
  }

  const { student } = progressData;

  return (
    <div className="page">
      <ParentNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="page-header">
        <div>
          <h1>{student.firstName} {student.lastName}</h1>
          <p className="subtitle">Roll No: {student.rollNumber}</p>
        </div>
        <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
      </div>

      {activeTab === 'overview' && (
        <OverviewTab analytics={progressData.analytics} attendance={attendance} chartRef={chartRef} />
      )}

      {activeTab === 'attendance' && (
        <AttendanceTab attendance={attendance} chartRef={chartRef} />
      )}

      {activeTab === 'progress' && (
        <ProgressTab
          progressData={progressData}
          filteredRecords={filteredRecords}
          subjects={subjects}
          subjectFilter={subjectFilter}
          setSubjectFilter={setSubjectFilter}
          examFilter={examFilter}
          setExamFilter={setExamFilter}
          chartRef={chartRef}
        />
      )}
    </div>
  );
}
