/**
 * Post-Login Navigation & Open-Redirect Prevention Utility
 */

export const DEFAULT_REDIRECT_PATH = "/dashboard";

/**
 * Returns the designated portal dashboard path for a given user role.
 * @param {string} role - User role (user, student, teacher, parent, admin)
 * @returns {string} Role-specific dashboard route
 */
export const getRoleDefaultDashboard = (role) => {
  const normalized = (role || "").toLowerCase().trim();
  switch (normalized) {
    case "teacher":
      return "/teacher/dashboard";
    case "parent":
      return "/parent/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "student":
    case "user":
    default:
      return "/student/dashboard";
  }
};

/**
 * Validates and sanitizes a redirect target URL to prevent Open Redirect vulnerabilities.
 */
export const sanitizeRedirectUrl = (rawUrl, fallbackPath = DEFAULT_REDIRECT_PATH) => {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallbackPath;
  }

  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return fallbackPath;
  }

  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallbackPath;
  }

  if (/^[/\\]{2,}/.test(trimmed) || /^[/\\][\\/]/.test(trimmed)) {
    return fallbackPath;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallbackPath;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return fallbackPath;
};

/**
 * Safely executes post-login redirection to the target role-specific dashboard route.
 * 
 * @param {Function} navigate - React Router navigate function
 * @param {string|Object} targetUrlOrUser - Target redirect path or User object/role string
 * @param {Object} options - Custom options (e.g. userRole: "teacher")
 */
export const performSecurePostLoginRedirect = (navigate, targetUrlOrUser = DEFAULT_REDIRECT_PATH, options = {}) => {
  let userRole = options.userRole;
  let targetUrl = typeof targetUrlOrUser === "string" ? targetUrlOrUser : DEFAULT_REDIRECT_PATH;

  if (typeof targetUrlOrUser === "object" && targetUrlOrUser !== null) {
    userRole = targetUrlOrUser.role;
  }

  // If target URL is generic /dashboard or default, resolve to role-specific dashboard
  if (!targetUrl || targetUrl === "/dashboard" || targetUrl === DEFAULT_REDIRECT_PATH) {
    if (userRole) {
      targetUrl = getRoleDefaultDashboard(userRole);
    }
  }

  const safePath = sanitizeRedirectUrl(targetUrl, userRole ? getRoleDefaultDashboard(userRole) : DEFAULT_REDIRECT_PATH);

  try {
    // 1. Check if running inside a popup child window with an accessible parent opener
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      try {
        const targetOrigin = window.location.origin;
        window.opener.location.href = targetOrigin + safePath;
        if (options.closePopup !== false) {
          window.close();
        }
        return { success: true, method: "opener", targetUrl: safePath };
      } catch (openerErr) {
        console.warn("Cross-origin restriction when accessing window.opener:", openerErr.message);
      }
    }

    // 2. Check if running inside an iframe with an accessible parent window
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      try {
        const targetOrigin = window.location.origin;
        window.parent.location.href = targetOrigin + safePath;
        return { success: true, method: "parent", targetUrl: safePath };
      } catch (parentErr) {
        console.warn("Cross-origin restriction when accessing window.parent:", parentErr.message);
      }
    }

    // 3. Standard React Router single-page navigation
    if (typeof navigate === "function") {
      navigate(safePath, { replace: true });
      return { success: true, method: "navigate", targetUrl: safePath };
    }

    // 4. Fallback direct window location assignment
    if (typeof window !== "undefined") {
      window.location.href = window.location.origin + safePath;
      return { success: true, method: "location", targetUrl: safePath };
    }

    return { success: false, method: "unavailable", targetUrl: safePath };
  } catch (err) {
    console.error("Redirection error encountered:", err.message);

    // Final emergency fallback
    try {
      if (typeof navigate === "function") {
        navigate(DEFAULT_REDIRECT_PATH, { replace: true });
      } else if (typeof window !== "undefined") {
        window.location.href = DEFAULT_REDIRECT_PATH;
      }
      return { success: true, method: "fallback", targetUrl: DEFAULT_REDIRECT_PATH };
    } catch (finalErr) {
      return { success: false, method: "failed", targetUrl: safePath, error: finalErr.message };
    }
  }
};
