import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useAuth } from "./auth/useAuth";
import PrivateRoute from "./auth/PrivateRoute";
import Login from "./components/Login";
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import ParentDashboard from "./components/ParentDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AdminRegisterForm from "./components/AdminRegisterForm";
import ResetPassword from "./components/ResetPassword";
import { getRoleDefaultDashboard } from "./utils/navigation";
import "./App.css";

// Dynamic Redirect Guard that sends logged-in users to their role-specific dashboard
const RoleRedirectGuard = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const rolePath = getRoleDefaultDashboard(user?.role);
  return <Navigate to={rolePath} replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Portal-Specific Exclusive Dashboard Routes */}
            <Route
              path="/student/dashboard"
              element={
                <PrivateRoute allowedRoles={["user", "student"]}>
                  <StudentDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/teacher/dashboard"
              element={
                <PrivateRoute allowedRoles={["teacher"]}>
                  <TeacherDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/parent/dashboard"
              element={
                <PrivateRoute allowedRoles={["parent"]}>
                  <ParentDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/register"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <div style={{ padding: "40px 20px", minHeight: "100vh", background: "var(--color-bg-page)" }}>
                    <AdminRegisterForm onCancel={() => window.location.href = "/admin/dashboard"} />
                  </div>
                </PrivateRoute>
              }
            />

            {/* Default Dashboard Guard & Catch-All */}
            <Route path="/dashboard" element={<RoleRedirectGuard />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;