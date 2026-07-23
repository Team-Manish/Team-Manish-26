import { useAuth } from "../auth/AuthContext";
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <h1>Welcome to your Dashboard!</h1>
        <div className="user-info">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> {user?.role}</p>
        </div>
        <button className="logout-btn" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
