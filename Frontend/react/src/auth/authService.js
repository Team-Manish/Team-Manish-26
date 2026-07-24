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
  } catch (err) {
    console.warn("CSRF fetch skipped (Backend might be offline or running standalone demo)", err);
    return "demo-csrf-token";
  }
};

// Login function
export const login = async (email, password, signal) => {
  let token = "demo-csrf-token";
  try {
    token = await fetchCsrfToken();
  } catch (err) {
    console.warn("Using demo token due to CSRF fetch notice", err);
  }

  try {
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
      throw new Error(data.message || "Invalid credentials");
    }

    currentUser = data.user;
    return {
      user: data.user,
      expiresAt: data.expiresAt,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    // If backend returns specific authentication error (e.g. invalid credentials), re-throw it
    if (error.message && (error.message === "Invalid credentials" || error.message.includes("attempts"))) {
      throw error;
    }

    // If fetch failed because backend is offline, enable seamless parent demo fallback
    if (error.name === "TypeError" || error.message.includes("fetch") || error.message.includes("Network")) {
      console.info("Backend server un-reachable. Engaging parent demo fallback auth mode.");
      
      // Simulate real auth network latency
      await new Promise(res => setTimeout(res, 800));

      if (email.toLowerCase() === "invalid@parent.com") {
        throw new Error("Invalid credentials");
      }
      if (email.toLowerCase() === "locked@parent.com") {
        throw new Error("Too many login attempts. Account temporarily locked for 15 minutes.");
      }

      const mockParent = {
        id: "parent-101",
        name: "Sarah Jenkins",
        email: email,
        role: "parent",
        children: [
          { name: "Ethan Jenkins", grade: "Grade 5", school: "Oakridge Elementary" },
          { name: "Lily Jenkins", grade: "Grade 2", school: "Oakridge Elementary" }
        ]
      };

      currentUser = mockParent;
      return {
        user: mockParent,
        expiresAt: Date.now() + 3600000,
      };
    }

    throw error;
  }
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
    console.warn("Backend logout error:", error);
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
  } catch (err) {
    console.debug("Session check fallback to local current user", err);
    return currentUser;
  }
};

// Get current user
export const getCurrentUser = () => currentUser;

// Check if user is authenticated
export const isAuthenticated = () => !!currentUser;
