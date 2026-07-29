import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { attendanceAPI, classAPI, studentAPI } from '../services/api';
import ExportButtons from '../components/ExportButtons';
import { generateCSV, generatePDF } from '../services/exportUtils';

const STATUS_OPTIONS = [
  { value: 'present', label: 'P', color: '#16a34a', bg: '#dcfce7' },
  { value: 'absent', label: 'A', color: '#dc2626', bg: '#fef2f2' },
  { value: 'late', label: 'L', color: '#d97706', bg: '#fef9c3' },
  { value: 'excused', label: 'E', color: '#2563eb', bg: '#dbeafe' },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

function StatusSelector({ value, onChange }) {
  return (
    <div className="att-status-group">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`att-status-btn ${value === opt.value ? 'active' : ''}`}
          style={{
            '--status-color': opt.color,
            '--status-bg': opt.bg,
          }}
          onClick={() => onChange(opt.value)}
          title={opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AttendanceRow({ student, record, onStatusChange, onRemarksChange, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <tr className="att-row">
      <td className="att-index">{index}</td>
      <td className="att-roll">{student.rollNumber}</td>
      <td className="att-name">{student.firstName} {student.lastName}</td>
      <td className="att-status-cell">
        <StatusSelector
          value={record?.status || 'present'}
          onChange={(status) => onStatusChange(student._id, status)}
        />
      </td>
      <td className="att-remarks-cell">
        <input
          type="text"
          className="att-remarks-input"
          value={record?.remarks || ''}
          onChange={(e) => onRemarksChange(student._id, e.target.value)}
          placeholder="Remarks"
          maxLength={200}
        />
      </td>
    </tr>
  );
}

function CountBar({ records }) {
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }, [records]);

  const total = records.length;

  return (
    <div className="att-count-bar">
      <span className="att-count-total">{total} students</span>
      <div className="att-count-dots">
        {STATUS_OPTIONS.map((opt) => (
          <span
            key={opt.value}
            className="att-count-dot"
            style={{ backgroundColor: counts[opt.value] > 0 ? opt.color : '#e5e7eb' }}
            title={`${opt.label}: ${counts[opt.value]}`}
          />
        ))}
      </div>
      <div className="att-count-labels">
        {STATUS_OPTIONS.map((opt) => (
          <span key={opt.value} className="att-count-item" style={{ color: opt.color }}>
            <span className="att-count-num">{counts[opt.value]}</span>
            <span className="att-count-label">{opt.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BulkBar({ onBulk }) {
  return (
    <div className="att-bulk-bar">
      <span className="att-bulk-label">Bulk set:</span>
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="att-bulk-btn"
          style={{ '--status-color': opt.color, '--status-bg': opt.bg }}
          onClick={() => onBulk(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SkeletonRows({ count }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={i} className="att-row att-row-skeleton">
          <td colSpan={5}>
            <div className="att-skeleton-inner">
              <div className="att-skeleton-line short" />
              <div className="att-skeleton-line" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function Attendance() {
  const reportRef = useRef(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingSummary, setExistingSummary] = useState(null);

  useEffect(() => {
    classAPI.getAll()
      .then((res) => setClasses(res.data.data || []))
      .catch(() => setMessage({ text: 'Failed to load classes', type: 'error' }));
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setRecords([]);
      setExistingSummary(null);
      return;
    }

    const cls = classes.find((c) => c._id === selectedClass);
    setSelectedClassName(cls ? `${cls.name} ${cls.section}` : '');

    let cancelled = false;

    const load = async () => {
      setLoadingStudents(true);
      setMessage({ text: '', type: '' });
      setExistingSummary(null);

      try {
        const res = await studentAPI.getByClass(selectedClass);
        if (cancelled) return;
        const list = res.data.data || [];
        setStudents(list);

        if (list.length === 0) {
          setRecords([]);
          setLoadingStudents(false);
          return;
        }

        setLoadingExisting(true);
        try {
          const attRes = await attendanceAPI.getByClassAndDate(selectedClass, date);
          if (cancelled) return;
          const attData = attRes.data.data;
          if (attData?.attendance?.length > 0) {
            const existing = attData.attendance.map((a) => ({
              studentId: a.student?._id || a.student,
              status: a.status,
              remarks: a.remarks || '',
            }));
            const merged = list.map((s) => {
              const found = existing.find((e) => e.studentId === s._id);
              return found || { studentId: s._id, status: 'present', remarks: '' };
            });
            setRecords(merged);
            setExistingSummary(attData.summary);
          } else {
            setRecords(list.map((s) => ({ studentId: s._id, status: 'present', remarks: '' })));
            setExistingSummary(null);
          }
        } catch {
          if (cancelled) return;
          setRecords(list.map((s) => ({ studentId: s._id, status: 'present', remarks: '' })));
          setExistingSummary(null);
        }
        setLoadingExisting(false);
      } catch {
        if (!cancelled) {
          setMessage({ text: 'Failed to load students', type: 'error' });
          setStudents([]);
          setRecords([]);
        }
      }

      if (!cancelled) setLoadingStudents(false);
    };

    load();
    return () => { cancelled = true; };
  }, [selectedClass, date, classes]);

  const handleStatusChange = useCallback((studentId, status) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  }, []);

  const handleRemarksChange = useCallback((studentId, remarks) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  }, []);

  const handleBulk = useCallback((status) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || records.length === 0) return;

    setSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      const payload = { classId: selectedClass, date, records };
      await attendanceAPI.mark(payload);
      setMessage({ text: `Attendance saved for ${selectedClassName} on ${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, type: 'success' });

      const attRes = await attendanceAPI.getByClassAndDate(selectedClass, date);
      if (attRes.data.data?.summary) {
        setExistingSummary(attRes.data.data.summary);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save attendance';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getExportTableData = useCallback(() => {
    if (!existingSummary && records.length === 0) return { headers: [], rows: [] };
    const headers = ['Roll No', 'Name', 'Status', 'Remarks'];
    const rows = students.map((s) => {
      const r = records.find((rec) => rec.studentId === s._id);
      return [
        s.rollNumber,
        `${s.firstName} ${s.lastName}`,
        r?.status || '-',
        r?.remarks || '-',
      ];
    });
    return { headers, rows };
  }, [students, records, existingSummary]);

  const handleExportPDF = () => {
    const { headers, rows } = getExportTableData();
    if (headers.length === 0) return;
    generatePDF({
      title: `Attendance Report - ${selectedClassName}`,
      subtitle: `Date: ${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} | Total: ${students.length} students`,
      headers,
      rows,
      filename: `edutrack-attendance-${date}`,
    });
  };

  const handleExportCSV = () => {
    const { headers, rows } = getExportTableData();
    if (headers.length === 0) return;
    generateCSV(headers, rows, `edutrack-attendance-${date}`);
  };

  const canSubmit = selectedClass && records.length > 0 && !submitting;

  return (
    <div className="page" ref={reportRef}>
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">Mark daily attendance for your class</p>
        </div>
        {records.length > 0 && (
          <ExportButtons onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        )}
      </div>

      <div className="att-controls">
        <div className="att-controls-row">
          <div className="form-group">
            <label>Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      {loadingStudents && (
        <div className="att-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="att-col-index">#</th>
                <th className="att-col-roll">Roll No</th>
                <th className="att-col-name">Name</th>
                <th className="att-col-status">Status</th>
                <th className="att-col-remarks">Remarks</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRows count={6} />
            </tbody>
          </table>
        </div>
      )}

      {!loadingStudents && students.length === 0 && selectedClass && (
        <div className="empty-state">
          No students found in this class. Add students in the admin panel first.
        </div>
      )}

      {!loadingStudents && !selectedClass && (
        <div className="empty-state">
          Select a class and date to begin recording attendance.
        </div>
      )}

      {!loadingStudents && students.length > 0 && (
        <form onSubmit={handleSubmit}>
          <div className="att-meta">
            <div className="att-meta-left">
              <span className="att-meta-class">{selectedClassName}</span>
              <span className="att-meta-date">
                {new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {existingSummary && (
                <span className="att-meta-existing">
                  Previously recorded
                </span>
              )}
            </div>
            <CountBar records={records} />
          </div>

          <BulkBar onBulk={handleBulk} />

          {loadingExisting && (
            <div className="att-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="att-col-index">#</th>
                    <th className="att-col-roll">Roll No</th>
                    <th className="att-col-name">Name</th>
                    <th className="att-col-status">Status</th>
                    <th className="att-col-remarks">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <SkeletonRows count={5} />
                </tbody>
              </table>
            </div>
          )}

          {!loadingExisting && (
            <div className="att-table-wrapper">
              <table className="data-table att-table">
                <thead>
                  <tr>
                    <th className="att-col-index">#</th>
                    <th className="att-col-roll">Roll No</th>
                    <th className="att-col-name">Name</th>
                    <th className="att-col-status">Status</th>
                    <th className="att-col-remarks">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, idx) => {
                    const student = students.find((s) => s._id === record.studentId);
                    if (!student) return null;
                    return (
                      <AttendanceRow
                        key={student._id}
                        index={idx + 1}
                        student={student}
                        record={record}
                        onStatusChange={handleStatusChange}
                        onRemarksChange={handleRemarksChange}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="att-submit-row">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={!canSubmit}
            >
              {submitting ? 'Saving...' : existingSummary ? 'Update Attendance' : 'Save Attendance'}
            </button>
            <span className="att-submit-hint">
              {existingSummary
                ? 'Attendance was previously recorded. Submitting will update existing records.'
                : `Record attendance for ${students.length} student${students.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
