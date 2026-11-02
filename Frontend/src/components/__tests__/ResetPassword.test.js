import test from "node:test";
import assert from "node:assert/strict";
import { extractTokenFromHash, scrubFragmentFromHistory } from "../../utils/resetToken.js";

test("Frontend ResetPassword Component - Rejects query-string token without URL fragment", () => {
  // Simulate a request where the token is passed in search params but NOT in fragment
  const simulatedHash = "";
  const token = extractTokenFromHash(simulatedHash);
  assert.equal(token, "", "Token must be empty when not present in fragment");
});

test("Frontend ResetPassword Component - Accepts and extracts valid fragment token", () => {
  const simulatedHash = "#token=component_test_token_789";
  const token = extractTokenFromHash(simulatedHash);
  assert.equal(token, "component_test_token_789");
});

test("Frontend ResetPassword Component - History scrubbing cleans URL immediately upon extraction", () => {
  let cleanedUrl = "";
  const mockWindow = {
    location: {
      pathname: "/reset-password",
      search: "",
      hash: "#token=component_test_token_789",
    },
    history: {
      replaceState: (_state, _title, url) => {
        cleanedUrl = url;
      },
    },
  };

  const extracted = extractTokenFromHash(mockWindow.location.hash);
  if (extracted) {
    scrubFragmentFromHistory(mockWindow);
  }

  assert.equal(extracted, "component_test_token_789");
  assert.equal(cleanedUrl, "/reset-password", "URL address bar must be cleaned of #token= immediately");
});
