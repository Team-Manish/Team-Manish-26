import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  login as loginService,
  logout as logoutService,
  checkSession,
  isAuthenticated,
} from "./authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize auth state on mount by checking session with backend
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await checkSession();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (email, password, signal) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginService(email, password, signal);
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    setError(null);

    try {
      await logoutService();
      setUser(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: isAuthenticated(),
    isLoading,
    isLoggingOut,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
