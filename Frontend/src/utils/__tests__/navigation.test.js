import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeRedirectUrl,
  performSecurePostLoginRedirect,
  DEFAULT_REDIRECT_PATH,
} from "../navigation.js";

test("sanitizeRedirectUrl - Valid Internal Relative Paths", () => {
  assert.equal(sanitizeRedirectUrl("/dashboard"), "/dashboard");
  assert.equal(sanitizeRedirectUrl("/student/progress?id=101"), "/student/progress?id=101");
  assert.equal(sanitizeRedirectUrl("/profile#settings"), "/profile#settings");
});

test("sanitizeRedirectUrl - Open Redirect Attack Prevention (External URLs)", () => {
  // Absolute URLs with protocols
  assert.equal(sanitizeRedirectUrl("http://attacker.com"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("https://evil.org/phishing"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("FTP://malicious.net"), DEFAULT_REDIRECT_PATH);

  // Protocol-relative URLs
  assert.equal(sanitizeRedirectUrl("//attacker.com"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("//evil.com/login"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("/\\attacker.com"), DEFAULT_REDIRECT_PATH);

  // Script and data URIs
  assert.equal(sanitizeRedirectUrl("javascript:alert('xss')"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("DATA:text/html,<script>alert(1)</script>"), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("VBSCRIPT:msgbox(1)"), DEFAULT_REDIRECT_PATH);
});

test("sanitizeRedirectUrl - Edge Cases & Empty Inputs", () => {
  assert.equal(sanitizeRedirectUrl(""), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl(null), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl(undefined), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl(123), DEFAULT_REDIRECT_PATH);
  assert.equal(sanitizeRedirectUrl("   "), DEFAULT_REDIRECT_PATH);
});

test("performSecurePostLoginRedirect - Single Window Navigation", () => {
  let navigatedPath = null;
  let optionsPassed = null;

  const mockNavigate = (path, options) => {
    navigatedPath = path;
    optionsPassed = options;
  };

  const result = performSecurePostLoginRedirect(mockNavigate, "/student/progress");
  assert.equal(result.success, true);
  assert.equal(result.method, "navigate");
  assert.equal(result.targetUrl, "/student/progress");
  assert.equal(navigatedPath, "/student/progress");
  assert.equal(optionsPassed.replace, true);
});

test("performSecurePostLoginRedirect - Sanitizes Malicious Target Automatically", () => {
  let navigatedPath = null;

  const mockNavigate = (path) => {
    navigatedPath = path;
  };

  const result = performSecurePostLoginRedirect(mockNavigate, "http://phishing.site");
  assert.equal(result.success, true);
  assert.equal(result.targetUrl, DEFAULT_REDIRECT_PATH);
  assert.equal(navigatedPath, DEFAULT_REDIRECT_PATH);
});
