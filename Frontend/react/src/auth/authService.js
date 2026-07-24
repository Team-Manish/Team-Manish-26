const API_BASE_URL = "http://localhost:5000/api/auth";
const API_ROOT = "http://localhost:5000/api";

// Store CSRF token
let csrfToken = null;
// Store user data locally
let currentUser = null;

// Fetch CSRF token
export const fetchCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const response = await fetch(`${API_ROOT}/csrf-token`, {
      credentials: "include",
    });
    const data = await response.json();
    if (data.success) {
      csrfToken = data.csrfToken;
      return csrfToken;
    }
    throw new Error("Failed to fetch CSRF token");
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
};

// Login function
export const login = async (email, password, signal) => {
  // Fetch CSRF token first
  const token = await fetchCsrfToken();

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": token,
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
    signal,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || "Login failed");
  }

  currentUser = data.user;

  return {
    user: data.user,
    expiresAt: data.expiresAt,
  };
};

// Logout function
export const logout = async () => {
  try {
    const token = await fetchCsrfToken();
    await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: {
        "X-XSRF-TOKEN": token,
      },
      credentials: "include",
    });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    currentUser = null;
    csrfToken = null;
  }
};

// Check current session with backend
export const checkSession = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      credentials: "include",
    });
    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      return data.user;
    }
    currentUser = null;
    return null;
  } catch (error) {
    console.error("Error checking session:", error);
    currentUser = null;
    return null;
  }
};

// Get current user
export const getCurrentUser = () => currentUser;

// Check if user is authenticated
export const isAuthenticated = () => !!currentUser;
