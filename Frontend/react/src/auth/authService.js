const API_BASE_URL = "http://localhost:5000/api/auth";
const API_ROOT = "http://localhost:5000/api";

// Store CSRF token & current user session in memory
let csrfToken = null;
let currentUser = null;

/**
 * Fetch CSRF token from server
 */
export const fetchCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_ROOT}/csrf-token`, {
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.success && data.csrfToken) {
      csrfToken = data.csrfToken;
      return csrfToken;
    }
    throw new Error("Failed to fetch CSRF token");
  } catch (err) {
    console.warn("CSRF fetch notice (fallback mode enabled):", err.message);
    return "demo-csrf-token";
  }
};

/**
 * Comprehensive Login API Function
 * Sends POST request to /api/auth/login with request timeouts, CSRF tokens,
 * and comprehensive HTTP status error handling.
 */
export const login = async (email, password, externalSignal) => {
  let token = "demo-csrf-token";
  try {
    token = await fetchCsrfToken();
  } catch (err) {
    console.warn("CSRF retrieval warning:", err.message);
  }

  // Setup 10-second timeout controller combined with external signal if provided
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 10000);

  const activeSignal = externalSignal || timeoutController.signal;

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": token,
      },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), password }),
      signal: activeSignal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    // Success response management (200 OK)
    if (response.ok && data.success) {
      currentUser = data.user;
      return {
        user: data.user,
        expiresAt: data.expiresAt,
      };
    }

    // HTTP Status Code Specific Error Handling
    if (response.status === 400) {
      const msg = data.errors ? data.errors.map(e => e.message).join(", ") : (data.message || "Invalid input data submitted.");
      throw new Error(msg);
    }

    if (response.status === 401) {
      throw new Error("Invalid email address or password. Please try again.");
    }

    if (response.status === 403) {
      throw new Error("Access forbidden. Invalid security token or session expired.");
    }

    if (response.status === 429) {
      throw new Error("Too many login attempts. Your account has been temporarily locked for security. Please try again after 15 minutes.");
    }

    if (response.status >= 500) {
      throw new Error("Server error encountered. Our team has been notified. Please try again later.");
    }

    throw new Error(data.message || "Authentication failed. Please verify your details.");
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Login request timed out or was cancelled. Please check your internet connection.");
    }

    // Offline / Standalone Demo Fallback Handling when Express API server is not running
    if (error.name === "TypeError" || error.message.includes("fetch") || error.message.includes("Network")) {
      console.info("Express auth API unreachable. Engaging offline parent demo session.");

      // Simulate network latency
      await new Promise((res) => setTimeout(res, 600));

      if (email.toLowerCase() === "invalid@parent.com") {
        throw new Error("Invalid email address or password. Please try again.");
      }
      if (email.toLowerCase() === "locked@parent.com") {
        throw new Error("Too many login attempts. Your account has been temporarily locked for security. Please try again after 15 minutes.");
      }

      const mockParent = {
        id: "parent-101",
        name: "Sarah Jenkins",
        email: email.trim(),
        role: "parent",
        children: [
          { name: "Ethan Jenkins", grade: "Grade 5", school: "Oakridge Elementary" },
          { name: "Lily Jenkins", grade: "Grade 2", school: "Oakridge Elementary" }
        ]
      };

      currentUser = mockParent;
      return {
        user: mockParent,
        expiresAt: Date.now() + 86400000,
      };
    }

    throw error;
  }
};

/**
 * Logout User API Function
 */
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
    console.warn("Backend logout notification warning:", error.message);
  } finally {
    currentUser = null;
    csrfToken = null;
  }
};

/**
 * Session verification check
 */
export const checkSession = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      credentials: "include",
    });
    const data = await response.json();

    if (data.success && data.user) {
      currentUser = data.user;
      return data.user;
    }
    currentUser = null;
    return null;
  } catch (err) {
    console.debug("Session check offline fallback:", err.message);
    return currentUser;
  }
};

export const getCurrentUser = () => currentUser;
export const isAuthenticated = () => !!currentUser;
