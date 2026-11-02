/**
 * Utility for secure handling of password reset tokens in the frontend (Phase 3B: Priority 3).
 * Enforces fragment-only token transmission (#token=...), strict rejection of query parameters,
 * and history scrubbing to ensure tokens are never logged or stored in browser history.
 */

/**
 * Extracts reset token strictly from URL fragment (#token=...).
 * Query parameters (?token=...) are completely disallowed and ignored.
 * Returns the decoded token string if present in the hash, or "" if absent.
 *
 * @param {string} hashString - The URL fragment string (e.g. window.location.hash)
 * @returns {string} The extracted token or empty string
 */
export function extractTokenFromHash(hashString = "") {
  if (!hashString || typeof hashString !== "string") return "";
  const cleanedHash = hashString.startsWith("#") ? hashString.slice(1) : hashString;
  const match = cleanedHash.match(/(?:^|&)token=([^&]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return "";
}

/**
 * Scrubs the URL fragment from browser address bar and history while preserving pathname and query.
 *
 * @param {Window} win - The window object (or mock)
 */
export function scrubFragmentFromHistory(win = typeof window !== "undefined" ? window : null) {
  if (win && win.history && typeof win.history.replaceState === "function" && win.location) {
    const cleanUrl = (win.location.pathname || "") + (win.location.search || "");
    win.history.replaceState(null, "", cleanUrl);
  }
}
