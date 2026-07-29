import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { classAPI, studentAPI, userAPI } from '../services/api';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

export default function Admin() {
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  // New Class Form State
  const [className, setClassName] = useState('');
  const [customClassName, setCustomClassName] = useState('');
  const [section, setSection] = useState('A');
  const [classTeacher, setClassTeacher] = useState('');
  const [classSubjects, setClassSubjects] = useState([]);

  // New Student Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [gender, setGender] = useState('Male');
  const [subjects, setSubjects] = useState([]);
  const [editingStudentId, setEditingStudentId] = useState(null);

  const subjectOptions = ['MATHS', 'JAVA', 'C LANG', 'HTML'];

  const classNameOptions = [
    'BCA', 'MCA', 'BSC.IT', 'BTECH',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    'Grade 11', 'Grade 12',
  ];

  const toggleSubject = (sub) => {
    setSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const toggleClassSubject = (sub) => {
    setClassSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classRes, studentRes, teacherRes] = await Promise.all([
        classAPI.getAll().catch(() => ({ data: { data: [] } })),
        studentAPI.getAll().catch(() => ({ data: { data: [] } })),
        userAPI.getAll({ role: 'teacher' }).catch(() => ({ data: { data: [] } })),
      ]);
      setClasses(classRes.data.data || []);
      setStudents(studentRes.data.data || []);
      setTeachers(teacherRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const finalName = className === 'Other' ? customClassName : className;
      await classAPI.create({ name: finalName, section, teacher: classTeacher || undefined, subjects: classSubjects });
      setMessage('Class created successfully!');
      setClassName('');
      setCustomClassName('');
      setSection('A');
      setClassTeacher('');
      setClassSubjects([]);
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to create class');
    }
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (editingStudentId) {
        await studentAPI.update(editingStudentId, {
          firstName,
          lastName,
          rollNumber,
          class: selectedClass,
          gender,
          subjects,
        });
        setMessage('Student updated successfully!');
      } else {
        await studentAPI.create({
          firstName,
          lastName,
          rollNumber,
          class: selectedClass,
          gender,
          subjects,
        });
        setMessage('Student added successfully!');
      }
      resetStudentForm();
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save student');
    }
  };

  const handleEditStudent = (s) => {
    setEditingStudentId(s._id);
    setFirstName(s.firstName);
    setLastName(s.lastName);
    setRollNumber(s.rollNumber);
    setSelectedClass(s.class?._id || s.class || '');
    setGender(s.gender || 'Male');
    setSubjects(s.subjects || []);
    setActiveTab('students');
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await studentAPI.delete(id);
      setMessage('Student deleted successfully');
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to delete student');
    }
  };

  const getExportTableData = () => {
    if (activeTab === 'students') {
      const headers = ['Roll No', 'Name', 'Class', 'Gender', 'Subjects'];
      const rows = students.map((s) => [
        s.rollNumber,
        `${s.firstName} ${s.lastName}`,
        s.class?.name ? `${s.class.name} (${s.class.section})` : '-',
        s.gender || '-',
        s.subjects?.length ? s.subjects.join(', ') : '-',
      ]);
      return { headers, rows };
    }
    const headers = ['Class Name', 'Section', 'Teacher', 'Subjects'];
    const rows = classes.map((c) => [
      c.name,
      c.section,
      c.teacher?.name || 'Unassigned',
      c.subjects?.length ? c.subjects.join(', ') : '-',
    ]);
    return { headers, rows };
  };

  const handleExportPDF = () => {
    const { headers, rows } = getExportTableData();
    generatePDF({
      title: 'School Administration Report',
      subtitle: `Tab: ${activeTab === 'students' ? 'Students' : 'Classes'} | Total: ${activeTab === 'students' ? students.length : classes.length}`,
      headers,
      rows,
      filename: `edutrack-admin-${activeTab}-${new Date().toISOString().split('T')[0]}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportTableData();
    generateCSV(headers, rows, `edutrack-admin-${activeTab}-${new Date().toISOString().split('T')[0]}`);
  };

  const resetStudentForm = () => {
    setEditingStudentId(null);
    setFirstName('');
    setLastName('');
    setRollNumber('');
    setSelectedClass('');
    setGender('Male');
    setSubjects([]);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page" ref={reportRef}>
      <div className="page-header">
        <div>
          <h1>School Administration</h1>
        </div>
        {(students.length > 0 || classes.length > 0) && (
          <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        )}
      </div>

      <div className="toggle-bar">
        <button
          className={`btn ${activeTab === 'students' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Manage Students ({students.length})
        </button>
        <button
          className={`btn ${activeTab === 'classes' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          Manage Classes ({classes.length})
        </button>
        <button
          className="btn"
          onClick={() => navigate('/admin/class-comparison')}
        >
          Class Comparison
        </button>
      </div>

      {message && (
        <div className={`alert ${message.toLowerCase().includes('success') || message.toLowerCase().includes('added') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="section">
          <h2>Create New Class</h2>
          <form onSubmit={handleCreateClass} className="filters" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
            <div className="form-group">
              <label>Class Name</label>
              <select value={className} onChange={(e) => setClassName(e.target.value)} required>
                <option value="">Select Class</option>
                {classNameOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="Other">Other (type below)</option>
              </select>
              {className === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter custom class name"
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                  required
                  style={{ marginTop: '0.3rem' }}
                />
              )}
            </div>
            <div className="form-group">
              <label>Section</label>
              <input
                type="text"
                placeholder="e.g. A"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Teacher</label>
              <select value={classTeacher} onChange={(e) => setClassTeacher(e.target.value)}>
                <option value="">Auto (self)</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>{t.name} ({t.email})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Add Class</button>
          </form>
          <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            <label>Subjects Offered</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
              {subjectOptions.map((sub) => (
                <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={classSubjects.includes(sub)}
                    onChange={() => toggleClassSubject(sub)}
                  />
                  {sub}
                </label>
              ))}
            </div>
          </div>

          <h2 style={{ marginTop: '1rem' }}>Existing Classes</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Class Name</th>
                <th>Section</th>
                <th>Teacher</th>
                <th>Subjects</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr><td colSpan="4">No classes found</td></tr>
              ) : (
                classes.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>{c.section}</td>
                    <td>{c.teacher?.name || 'Unassigned'}</td>
                    <td>{c.subjects?.length ? c.subjects.join(', ') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="section">
          <h2>{editingStudentId ? 'Edit Student' : 'Add New Student'}</h2>
          <form onSubmit={handleSaveStudent} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Class</label>
              {classes.length === 0 ? (
                <div style={{ padding: '0.5rem 0' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>No classes found.</p>
                  <button type="button" className="btn btn-sm" onClick={() => setActiveTab('classes')}>
                    + Create Class
                  </button>
                </div>
              ) : (
                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required>
                  <option value="">-- Select Class --</option>
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} - {c.section}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Subjects</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                {subjectOptions.map((sub) => (
                  <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={subjects.includes(sub)}
                      onChange={() => toggleSubject(sub)}
                    />
                    {sub}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingStudentId ? 'Update' : 'Add Student'}
              </button>
              {editingStudentId && (
                <button type="button" className="btn" onClick={resetStudentForm}>Cancel</button>
              )}
            </div>
          </form>

          <h2>Student Directory</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Class</th>
                <th>Gender</th>
                <th>Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan="6">No students found</td></tr>
              ) : (
                students.map((s) => (
                  <tr key={s._id}>
                    <td>{s.rollNumber}</td>
                    <td>{s.firstName} {s.lastName}</td>
                    <td>{s.class?.name ? `${s.class.name} (${s.class.section})` : '-'}</td>
                    <td>{s.gender || '-'}</td>
                    <td>{s.subjects?.length ? s.subjects.join(', ') : '-'}</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-sm" onClick={() => handleEditStudent(s)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteStudent(s._id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
