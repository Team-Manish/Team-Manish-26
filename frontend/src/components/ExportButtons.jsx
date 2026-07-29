import { useState, useCallback } from 'react';

function Toast({ message, type, visible }) {
  if (!visible) return null;
  const bg = type === 'success' ? '#16a34a' : '#dc2626';
  return (
    <div
      className="export-toast"
      style={{ background: bg }}
      role="alert"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {type === 'success'
          ? <polyline points="20 6 9 17 4 12" />
          : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
        }
      </svg>
      <span>{message}</span>
    </div>
  );
}

export default function ExportButtons({ onExportPDF, onExportCSV, disabled }) {
  const [exporting, setExporting] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

  const showToast = useCallback((message, type) => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  }, []);

  const handleExport = useCallback(async (format, handler, label) => {
    if (exporting) return;
    setExporting(format);
    try {
      await handler();
      showToast(`${label} downloaded successfully`, 'success');
    } catch (err) {
      const msg = err?.message || err?.toString() || `Failed to export ${label}`;
      showToast(msg, 'error');
    } finally {
      setExporting(null);
    }
  }, [exporting, showToast]);

  const handlePDF = useCallback(() => handleExport('pdf', onExportPDF, 'PDF'), [handleExport, onExportPDF]);
  const handleCSV = useCallback(() => handleExport('csv', onExportCSV, 'CSV'), [handleExport, onExportCSV]);

  const isDisabled = disabled || exporting !== null;

  return (
    <>
      <div className="export-buttons">
        <button
          className={`btn btn-export btn-export-pdf ${exporting === 'pdf' ? 'btn-export-loading' : ''}`}
          onClick={handlePDF}
          disabled={isDisabled}
          title="Download as PDF"
        >
          {exporting === 'pdf' ? (
            <span className="export-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          )}
          PDF
        </button>
        <button
          className={`btn btn-export btn-export-csv ${exporting === 'csv' ? 'btn-export-loading' : ''}`}
          onClick={handleCSV}
          disabled={isDisabled}
          title="Download as CSV"
        >
          {exporting === 'csv' ? (
            <span className="export-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          )}
          CSV
        </button>
      </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  );
}
