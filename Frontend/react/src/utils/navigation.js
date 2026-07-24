/**
 * Post-Login Navigation & Open-Redirect Prevention Utility
 */

export const DEFAULT_REDIRECT_PATH = "/dashboard";

/**
 * Validates and sanitizes a redirect target URL to prevent Open Redirect vulnerabilities.
 * Allows relative paths starting with '/' but strictly blocks:
 * - Protocol-relative URLs (e.g. '//attacker.com', '/\attacker.com')
 * - Absolute URLs with protocols (e.g. 'http://', 'https://')
 * - Script or data URI schemes (e.g. 'javascript:', 'data:', 'vbscript:')
 * - Absolute URLs containing domain authority
 * 
 * @param {string} rawUrl - Candidate redirect target URL
 * @param {string} fallbackPath - Default safe fallback path (/dashboard)
 * @returns {string} Sanitized safe relative URL
 */
export const sanitizeRedirectUrl = (rawUrl, fallbackPath = DEFAULT_REDIRECT_PATH) => {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallbackPath;
  }

  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return fallbackPath;
  }

  // Block script and data schemes
  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallbackPath;
  }

  // Block protocol-relative URLs (e.g., //evil.com or /\evil.com or \\evil.com)
  if (/^[/\\]{2,}/.test(trimmed) || /^[/\\][\\/]/.test(trimmed)) {
    return fallbackPath;
  }

  // Block absolute URLs with explicit schemes (e.g. http://, https://)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallbackPath;
  }

  // Ensure path starts with a single '/'
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return fallbackPath;
};

/**
 * Safely executes post-login redirection to the target dashboard route.
 * Handles parent window detection, popup contexts, cross-origin security restrictions,
 * and falls back gracefully to React Router navigate or location assignment.
 * 
 * @param {Function} navigate - React Router navigate function
 * @param {string} targetUrl - Target redirect path
 * @param {Object} options - Custom options (e.g. closePopup: true)
 * @returns {{ success: boolean, method: string, targetUrl: string, error?: string }}
 */
export const performSecurePostLoginRedirect = (navigate, targetUrl = DEFAULT_REDIRECT_PATH, options = {}) => {
  const safePath = sanitizeRedirectUrl(targetUrl);

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
