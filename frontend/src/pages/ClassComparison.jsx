import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { progressAPI } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TIME_PERIODS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: 'quarter' },
  { label: 'This Year', value: 'year' },
];

function getDateRange(period) {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start = '';

  switch (period) {
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      start = d.toISOString().split('T')[0];
      break;
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      start = d.toISOString().split('T')[0];
      break;
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      start = d.toISOString().split('T')[0];
      break;
    }
    default:
      start = '';
  }

  return { startDate: start, endDate: end };
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
    </div>
  );
}

function getBarColor(pct) {
  if (pct >= 90) return '#16a34a';
  if (pct >= 75) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  if (pct >= 40) return '#f97316';
  return '#ef4444';
}

function getBarBorder(pct) {
  if (pct >= 90) return '#15803d';
  if (pct >= 75) return '#16a34a';
  if (pct >= 60) return '#d97706';
  if (pct >= 40) return '#ea580c';
  return '#dc2626';
}

function SkeletonChart() {
  return (
    <div className="cc-skeleton-chart">
      <div className="cc-skeleton-bar" style={{ height: '60%' }} />
      <div className="cc-skeleton-bar" style={{ height: '85%' }} />
      <div className="cc-skeleton-bar" style={{ height: '45%' }} />
      <div className="cc-skeleton-bar" style={{ height: '75%' }} />
      <div className="cc-skeleton-bar" style={{ height: '55%' }} />
    </div>
  );
}

export default function ClassComparison() {
  const [classData, setClassData] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState('all');

  const chartRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (subjectFilter !== 'all') params.subject = subjectFilter;

      const { startDate, endDate } = getDateRange(timePeriod);
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await progressAPI.getClassComparison(params);
      setClassData(res.data.data.classes || []);
      setSubjects(res.data.data.subjects || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load class comparison data');
    } finally {
      setLoading(false);
    }
  }, [subjectFilter, timePeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    if (!classData.length) return { total: 0, avg: 0, highest: 0, lowest: 0 };
    const avgs = classData.map((c) => c.overallPercentage);
    return {
      total: classData.length,
      avg: Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length),
      highest: Math.max(...avgs),
      lowest: Math.min(...avgs),
    };
  }, [classData]);

  const chartData = useMemo(() => {
    if (!classData.length) return null;

    const labels = classData.map((c) => c.section ? `${c.className} (${c.section})` : c.className);
    const percentages = classData.map((c) => c.overallPercentage);

    return {
      labels,
      datasets: [
        {
          label: 'Average Score (%)',
          data: percentages,
          backgroundColor: percentages.map(getBarColor),
          borderColor: percentages.map(getBarBorder),
          borderWidth: 2,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          barThickness: Math.min(72, Math.max(36, 600 / Math.max(classData.length, 1))),
        },
      ],
    };
  }, [classData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Class-wise Average Performance',
        font: { size: 16, weight: '600' },
        color: '#1e293b',
        padding: { bottom: 24 },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const cls = classData[ctx.dataIndex];
            return [
              `Average: ${ctx.parsed.y}%`,
              `Students: ${cls.totalStudents}`,
              `Records: ${cls.totalRecords}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
          font: { size: 12 },
          color: '#64748b',
          stepSize: 20,
        },
        grid: { color: '#f1f5f9', drawBorder: false },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 12, weight: '500' },
          color: '#1e293b',
        },
        border: { display: false },
      },
    },
  }), [classData]);

  const hasData = classData.length > 0;

  const getExportTableData = () => {
    const headers = ['Class', 'Section', 'Average Score (%)', 'Total Records', 'Students', 'Subjects'];
    const rows = classData.map((cls) => [
      cls.className,
      cls.section,
      cls.overallPercentage,
      cls.totalRecords,
      cls.totalStudents,
      cls.subjects.map((s) => s.subject).join(', '),
    ]);
    return { headers, rows };
  };

  const handleExportPDF = () => {
    const { headers, rows } = getExportTableData();
    const period = TIME_PERIODS.find((p) => p.value === timePeriod)?.label || 'All Time';
    const canvases = chartRef.current
      ? Array.from(chartRef.current.querySelectorAll('canvas'))
      : [];
    generatePDF({
      title: 'Class Comparison Report',
      subtitle: `Subject: ${subjectFilter === 'all' ? 'All' : subjectFilter} | Period: ${period}`,
      headers,
      rows,
      chartCanvases: canvases,
      filename: `edutrack-class-comparison-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportTableData();
    generateCSV(headers, rows, `edutrack-class-comparison-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Class Comparison</h1>
          <p className="subtitle">Compare average academic performance across classes</p>
        </div>
        {hasData && !loading && (
          <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button
            className="btn btn-sm"
            style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid #fecaca', color: '#dc2626' }}
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="cc-controls">
        <div className="form-group">
          <label>Subject</label>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Time Period</label>
          <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)}>
            {TIME_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`cc-content ${loading ? 'cc-content-loading' : ''}`}>
        <div className="stats-grid">
          <StatCard label="Total Classes" value={loading ? '-' : stats.total} color="#4f46e5" />
          <StatCard label="Overall Average" value={loading ? '-' : `${stats.avg}%`} color="#3b82f6" />
          <StatCard label="Highest Class" value={loading ? '-' : `${stats.highest}%`} color="#22c55e" />
          <StatCard label="Lowest Class" value={loading ? '-' : `${stats.lowest}%`} color="#ef4444" />
        </div>

        <div className="section" ref={chartRef}>
          {loading ? (
            <div className="chart-container">
              <SkeletonChart />
            </div>
          ) : !hasData ? (
            <div className="empty-state">
              No class data found for the selected filters. Record some student progress first.
            </div>
          ) : (
            <div className="chart-container cc-chart-container">
              <div className="cc-chart-legend">
                <span className="cc-legend-item"><span className="cc-legend-dot" style={{ background: '#22c55e' }} /> 75-100%</span>
                <span className="cc-legend-item"><span className="cc-legend-dot" style={{ background: '#f59e0b' }} /> 60-74%</span>
                <span className="cc-legend-item"><span className="cc-legend-dot" style={{ background: '#f97316' }} /> 40-59%</span>
                <span className="cc-legend-item"><span className="cc-legend-dot" style={{ background: '#ef4444' }} /> Below 40%</span>
              </div>
              <div className="cc-chart-body">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          )}
        </div>

        {hasData && !loading && (
          <div className="section">
            <h2>Detailed Breakdown</h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Average Score</th>
                    <th>Total Records</th>
                    <th>Students</th>
                    <th>Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.map((cls) => (
                    <tr key={cls.classId}>
                      <td><strong>{cls.className}</strong></td>
                      <td>{cls.section}</td>
                      <td>
                        <span
                          className="grade-pill"
                          style={{ background: getBarColor(cls.overallPercentage) }}
                        >
                          {cls.overallPercentage}%
                        </span>
                      </td>
                      <td>{cls.totalRecords}</td>
                      <td>{cls.totalStudents}</td>
                      <td>
                        <div className="cc-subject-tags">
                          {cls.subjects.map((s, i) => (
                            <span key={i} className="subject-tag">{s.subject}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
