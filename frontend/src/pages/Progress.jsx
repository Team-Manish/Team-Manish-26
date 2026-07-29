import { useState, useEffect, useRef, useCallback } from 'react';
import { attendanceAPI, classAPI } from '../services/api';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Progress() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const chartSectionRef = useRef(null);

  useEffect(() => {
    classAPI.getAll().then((res) => setClasses(res.data.data || [])).catch(() => {});
  }, []);

  const fetchSummary = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const res = await attendanceAPI.getSummary(selectedClass, dateRange.startDate, dateRange.endDate);
      setSummary(res.data.data);
      const cls = classes.find((c) => c._id === selectedClass);
      setSelectedClassName(cls ? `${cls.name} (${cls.section})` : '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = useCallback(() => {
    if (!summary?.summary) return null;
    const labels = summary.summary.map((s) => `${s.firstName} ${s.lastName}`);
    const presentData = summary.summary.map((s) => {
      const present = s.records.find((r) => r.status === 'present');
      return present ? present.count : 0;
    });
    const absentData = summary.summary.map((s) => {
      const absent = s.records.find((r) => r.status === 'absent');
      return absent ? absent.count : 0;
    });
    const lateData = summary.summary.map((s) => {
      const late = s.records.find((r) => r.status === 'late');
      return late ? late.count : 0;
    });

    const totalPresent = presentData.reduce((a, b) => a + b, 0);
    const totalAbsent = absentData.reduce((a, b) => a + b, 0);
    const totalLate = lateData.reduce((a, b) => a + b, 0);
    const totalExcused = summary.summary.reduce((acc, s) => {
      const exc = s.records.find((r) => r.status === 'excused');
      return acc + (exc ? exc.count : 0);
    }, 0);

    return {
      lineData: {
        labels,
        datasets: [
          { label: 'Present', data: presentData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true },
          { label: 'Absent', data: absentData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true },
          { label: 'Late', data: lateData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true },
        ],
      },
      doughnutData: {
        labels: ['Present', 'Absent', 'Late', 'Excused'],
        datasets: [{
          data: [totalPresent, totalAbsent, totalLate, totalExcused],
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
        }],
      },
      tableData: summary.summary.map((s) => ({
        rollNumber: s.rollNumber,
        name: `${s.firstName} ${s.lastName}`,
        totalDays: s.totalDays,
        present: s.records.find((r) => r.status === 'present')?.count || 0,
        absent: s.records.find((r) => r.status === 'absent')?.count || 0,
        late: s.records.find((r) => r.status === 'late')?.count || 0,
        excused: s.records.find((r) => r.status === 'excused')?.count || 0,
        rate: s.attendancePercentage,
      })),
    };
  }, [summary]);

  const charts = getChartData();

  const getExportTableData = () => {
    if (!charts) return { headers: [], rows: [] };
    const headers = ['Roll No', 'Name', 'Total Days', 'Present', 'Absent', 'Late', 'Excused', 'Rate (%)'];
    const rows = charts.tableData.map((s) => [
      s.rollNumber, s.name, s.totalDays, s.present, s.absent, s.late, s.excused, `${s.rate}%`,
    ]);
    return { headers, rows };
  };

  const handleExportPDF = () => {
    if (!charts) return;
    const { headers, rows } = getExportTableData();
    const canvases = chartSectionRef.current
      ? Array.from(chartSectionRef.current.querySelectorAll('canvas'))
      : [];
    generatePDF({
      title: 'Performance Dashboard Report',
      subtitle: `Class: ${selectedClassName || 'N/A'} | Period: ${dateRange.startDate} to ${dateRange.endDate}`,
      headers,
      rows,
      chartCanvases: canvases,
      filename: `edutrack-performance-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportTableData();
    generateCSV(headers, rows, `edutrack-performance-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Performance Dashboard</h1>
          <p className="subtitle">Attendance analytics and visual reports</p>
        </div>
        {charts && (
          <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        )}
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name} - {c.section}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
        </div>
        <button className="btn btn-primary" onClick={fetchSummary} disabled={!selectedClass || loading}>
          {loading ? 'Loading...' : 'Analyze'}
        </button>
      </div>

      {charts && (
        <div className="chart-grid" ref={chartSectionRef}>
          <div className="chart-container">
            <h3>Attendance per Student</h3>
            <div style={{ position: 'relative', height: 300 }}>
              <Line data={charts.lineData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
            </div>
          </div>
          <div className="chart-container">
            <h3>Overall Distribution</h3>
            <div style={{ position: 'relative', height: 300 }}>
              <Doughnut data={charts.doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          </div>
        </div>
      )}

      {summary?.summary && (
        <div className="section" style={{ marginTop: '1.5rem' }}>
          <h2>Detailed Attendance Records</h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Roll No</th><th>Name</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {charts.tableData.map((s) => (
                  <tr key={s.rollNumber}>
                    <td>{s.rollNumber}</td>
                    <td>{s.name}</td>
                    <td>{s.totalDays}</td>
                    <td><span className="status-badge present">{s.present}</span></td>
                    <td><span className="status-badge absent">{s.absent}</span></td>
                    <td><span className="status-badge late">{s.late}</span></td>
                    <td><span className="status-badge excused">{s.excused}</span></td>
                    <td><strong>{s.rate}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!charts && !loading && (
        <div className="empty-state">
          Select a class and click "Analyze" to view attendance performance data.
        </div>
      )}
    </div>
  );
}
