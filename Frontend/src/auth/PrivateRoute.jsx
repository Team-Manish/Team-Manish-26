import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { getRoleDefaultDashboard } from "../utils/navigation";

const PrivateRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRole = (user?.role || "user").toLowerCase();
    const isAllowed = allowedRoles.some((role) => role.toLowerCase() === userRole);

    if (!isAllowed) {
      const redirectPath = getRoleDefaultDashboard(userRole);
      return <Navigate to={redirectPath} replace />;
    }
  }

  return children;
};

export default PrivateRoute;
