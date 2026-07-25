import { useAuth } from "../auth/useAuth";
import ThemeToggle from "./ThemeToggle";
import "./Dashboard.css";

const AdminDashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();

  const userList = [
    { id: "USR-101", email: "student@school.com", role: "user", status: "Active", lastLogin: "2 mins ago" },
    { id: "USR-102", email: "teacher@school.com", role: "teacher", status: "Active", lastLogin: "10 mins ago" },
    { id: "USR-103", email: "parent@school.com", role: "parent", status: "Active", lastLogin: "1 hour ago" },
    { id: "USR-104", email: "admin@school.com", role: "admin", status: "Active", lastLogin: "Just now" },
  ];

  return (
    <main className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>🛡️ System Administration & Telemetry Portal</h1>
          <p className="user-badge">
            Signed in as: <strong>{user?.email}</strong>{" "}
            <span style={{ textTransform: "uppercase", padding: "2px 8px", background: "var(--color-primary-light)", color: "var(--color-primary)", borderRadius: "12px", fontWeight: "bold", fontSize: "12px", marginLeft: "6px" }}>
              {user?.role}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle />
          <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Telemetry Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>System Uptime</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-success-text)", fontSize: "28px" }}>99.99%</h2>
          <span style={{ color: "var(--color-success-text)", fontSize: "12px", fontWeight: "600" }}>✓ All Services Operational</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Registered Users</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-primary)", fontSize: "28px" }}>52 Accounts</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>RBAC Enforced</span>
        </div>

        <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", padding: "20px", borderRadius: "16px", boxShadow: "var(--shadow-card)" }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: "600" }}>Database Host</span>
          <h2 style={{ margin: "8px 0 0 0", color: "var(--color-accent-amber)", fontSize: "28px" }}>Atlas Cloud</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Latency: 18ms</span>
        </div>
      </div>

      {/* User Roster Table */}
      <div style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px", boxShadow: "var(--shadow-card)" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", color: "var(--color-text-main)" }}>System User Directory & Role Assignments</h2>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left", color: "var(--color-text-muted)" }}>
              <th style={{ padding: "12px 8px" }}>User ID</th>
              <th style={{ padding: "12px 8px" }}>Email</th>
              <th style={{ padding: "12px 8px" }}>Assigned Role</th>
              <th style={{ padding: "12px 8px" }}>Account Status</th>
              <th style={{ padding: "12px 8px" }}>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "12px 8px", fontWeight: "600" }}>{u.id}</td>
                <td style={{ padding: "12px 8px" }}>{u.email}</td>
                <td style={{ padding: "12px 8px" }}>
                  <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", background: "var(--color-primary-light)", color: "var(--color-primary)", textTransform: "uppercase" }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", background: "var(--color-success-bg)", color: "var(--color-success-text)" }}>
                    {u.status}
                  </span>
                </td>
                <td style={{ padding: "12px 8px", color: "var(--color-text-muted)", fontSize: "13px" }}>{u.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminDashboard;
