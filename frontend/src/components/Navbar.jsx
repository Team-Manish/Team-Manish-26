import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">EduTrack</Link>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            {(user.role === 'teacher' || user.role === 'admin') && (
              <>
                <Link to="/attendance">Attendance</Link>
                <Link to="/progress">Progress</Link>
              </>
            )}
            {user.role === 'parent' && (
              <Link to="/parent">My Child</Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin">Admin</Link>
            )}
            <span className="navbar-user">{user.name} ({user.role})</span>
            <button onClick={handleLogout} className="btn btn-sm">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
