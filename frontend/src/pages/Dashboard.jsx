import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { classAPI, studentAPI } from '../services/api';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ classes: 0, students: 0 });
  const [recentStudents, setRecentStudents] = useState([]);
  const reportRef = useRef(null);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'teacher') {
      Promise.all([
        classAPI.getAll().catch(() => ({ data: { data: [] } })),
        studentAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]).then(([classRes, studentRes]) => {
        const classes = classRes.data.data || [];
        const students = studentRes.data.data || [];
        setStats({ classes: classes.length, students: students.length });
        setRecentStudents(students.slice(0, 10));
      });
    }
  }, [user]);

  const teacherCards = [
    { title: 'Record Attendance', desc: 'Mark daily attendance for your class', link: '/attendance', icon: '📋' },
    { title: 'Update Progress', desc: 'Add grades and remarks for students', link: '/progress', icon: '📝' },
    { title: 'Performance Dashboard', desc: 'View attendance analytics & charts', link: '/progress', icon: '📊' },
  ];

  const parentCards = [
    { title: 'My Child', desc: 'View attendance and progress reports', link: '/parent', icon: '👶' },
  ];

  const adminCards = [
    { title: 'School Overview', desc: 'Monitor school-wide attendance trends', link: '/admin', icon: '📊' },
    { title: 'Manage Students', desc: 'Add and manage student records', link: '/admin/students', icon: '👥' },
    { title: 'Class Comparison', desc: 'Compare performance across classes', link: '/admin/class-comparison', icon: '📈' },
  ];

  const cards = {
    teacher: teacherCards,
    parent: parentCards,
    admin: [...teacherCards, ...adminCards],
  };

  const getExportData = () => {
    const headers = ['#', 'Name', 'Roll No', 'Class', 'Gender'];
    const rows = recentStudents.map((s, i) => [
      i + 1,
      `${s.firstName} ${s.lastName}`,
      s.rollNumber,
      s.class ? `${s.class.name} (${s.class.section})` : '-',
      s.gender || '-',
    ]);
    return { headers, rows };
  };

  const handleExportPDF = () => {
    const { headers, rows } = getExportData();
    generatePDF({
      title: 'School Dashboard Report',
      subtitle: `User: ${user?.name} (${user?.role}) | Classes: ${stats.classes} | Students: ${stats.students}`,
      headers,
      rows,
      filename: `edutrack-dashboard-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportData();
    generateCSV(headers, rows, `edutrack-dashboard-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="dashboard" ref={reportRef}>
      <div className="dashboard-header">
        <div className="dashboard-header-row">
          <div>
            <h1>Welcome, {user?.name}</h1>
            <p>Role: <span className="badge">{user?.role}</span></p>
          </div>
          {(user?.role === 'admin' || user?.role === 'teacher') && recentStudents.length > 0 && (
            <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
          )}
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'teacher') && (
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeftColor: '#4f46e5' }}>
            <span className="stat-label">Total Classes</span>
            <span className="stat-value" style={{ color: '#4f46e5' }}>{stats.classes}</span>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#3b82f6' }}>
            <span className="stat-label">Total Students</span>
            <span className="stat-value" style={{ color: '#3b82f6' }}>{stats.students}</span>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#22c55e' }}>
            <span className="stat-label">Active Role</span>
            <span className="stat-value" style={{ color: '#22c55e', fontSize: '1.2rem' }}>{user?.role}</span>
          </div>
        </div>
      )}

      <div className="card-grid">
        {(cards[user?.role] || []).map((card) => (
          <Link to={card.link} key={card.title} className="dash-card">
            <span className="dash-card-icon">{card.icon}</span>
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </Link>
        ))}
      </div>

      {(user?.role === 'admin' || user?.role === 'teacher') && recentStudents.length > 0 && (
        <div className="section" style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <h2>Recent Students</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Gender</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((s) => (
                  <tr key={s._id}>
                    <td>{s.rollNumber}</td>
                    <td>{s.firstName} {s.lastName}</td>
                    <td>{s.class ? `${s.class.name} (${s.class.section})` : '-'}</td>
                    <td>{s.gender || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
