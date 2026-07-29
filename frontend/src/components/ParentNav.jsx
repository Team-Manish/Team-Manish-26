import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'progress', label: 'Progress' },
];

function ConfirmModal({ open, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="pn-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div className="pn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pn-modal-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 id="logout-title">Log out of EduTrack?</h3>
        <p className="pn-modal-text">You will be redirected to the login page.</p>
        <div className="pn-modal-actions">
          <button className="btn" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn pn-modal-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ name }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  return (
    <span className="pn-avatar" title={name}>{initials}</span>
  );
}

function TabIcon({ tab }) {
  const paths = {
    overview: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    attendance: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
    progress: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  };
  return <span className="pn-tab-icon">{paths[tab.key]}</span>;
}

export default function ParentNav({ activeTab, onTabChange }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user || user.role !== 'parent') return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    await new Promise((r) => setTimeout(r, 300));
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="pn" aria-label="Parent portal navigation">
        <div className="pn-left">
          <div className="pn-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`pn-tab ${activeTab === tab.key ? 'pn-tab-active' : ''}`}
                onClick={() => onTabChange(tab.key)}
              >
                <TabIcon tab={tab} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pn-right">
          <div className="pn-user">
            <UserAvatar name={user.name} />
            <span className="pn-user-name">{user.name}</span>
          </div>
          <button
            className="pn-logout-btn"
            onClick={() => setShowConfirm(true)}
            title="Log out"
            aria-label="Log out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      </nav>

      <ConfirmModal
        open={showConfirm}
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => { if (!loggingOut) setShowConfirm(false); }}
      />
    </>
  );
}
