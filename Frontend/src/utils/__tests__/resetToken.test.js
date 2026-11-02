import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTokenFromHash,
  scrubFragmentFromHistory,
} from "../resetToken.js";

test("Priority 3: extractTokenFromHash - Extracts token from standard URL fragment (#token=...)", () => {
  const hash = "#token=a1b2c3d4e5f67890123456789012345678901234567890123456789012345678";
  const token = extractTokenFromHash(hash);
  assert.equal(token, "a1b2c3d4e5f67890123456789012345678901234567890123456789012345678");
});

test("Priority 3: extractTokenFromHash - Extracts token from fragment with additional fragment parameters", () => {
  const hash = "#lang=en&token=my_secure_reset_token_456&theme=dark";
  const token = extractTokenFromHash(hash);
  assert.equal(token, "my_secure_reset_token_456");
});

test("Priority 3: extractTokenFromHash - Decodes URI encoded characters in token fragment", () => {
  const hash = "#token=token%2Bwith%2Fspecial%3Dchars";
  const token = extractTokenFromHash(hash);
  assert.equal(token, "token+with/special=chars");
});

test("Priority 3: extractTokenFromHash - Query-string fallback is completely removed: query strings return empty string", () => {
  // When a user opens /reset-password?token=secret_query_token, window.location.hash is empty
  const hash = "";
  const token = extractTokenFromHash(hash);
  assert.equal(token, "", "Query string token must be rejected: empty hash must yield empty token");
});

test("Priority 3: extractTokenFromHash - Null, undefined, empty, or non-string inputs safely return empty string", () => {
  assert.equal(extractTokenFromHash(""), "");
  assert.equal(extractTokenFromHash(null), "");
  assert.equal(extractTokenFromHash(undefined), "");
  assert.equal(extractTokenFromHash(12345), "");
  assert.equal(extractTokenFromHash({}), "");
});

test("Priority 3: extractTokenFromHash - Hashes without token parameter return empty string", () => {
  assert.equal(extractTokenFromHash("#section=overview"), "");
  assert.equal(extractTokenFromHash("#access_token=wrong_param_name"), "");
  assert.equal(extractTokenFromHash("#token="), "");
});

test("Priority 3: scrubFragmentFromHistory - Replaces state to strip fragment without navigating", () => {
  let replacedState = null;
  let replacedUrl = null;

  const mockWindow = {
    location: {
      pathname: "/reset-password",
      search: "?ref=portal",
      hash: "#token=sensitive_raw_token_999",
    },
    history: {
      replaceState: (state, title, url) => {
        replacedState = state;
        replacedUrl = url;
      },
    },
  };

  scrubFragmentFromHistory(mockWindow);

  assert.equal(replacedState, null);
  assert.equal(replacedUrl, "/reset-password?ref=portal", "Address bar must be scrubbed of fragment while preserving path and search");
});
