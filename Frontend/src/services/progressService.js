/**
 * Progress Update API Service Module
 * Handles resilient progress data transmission with schema validation,
 * request deduplication, exponential backoff retries, and timeout controls.
 */

const VALID_STATUSES = ["pending", "in_progress", "completed", "blocked"];
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 300;

// Cache map tracking active in-flight requests for deduplication
const inFlightRequestsMap = new Map();

/**
 * Validates progress payload structure before sending to network
 */
export const validateProgressData = (data) => {
  if (!data || typeof data !== "object") {
    return "Progress data payload must be a non-null object.";
  }

  const { progressPercentage, taskId, statusIdentifier } = data;

  if (progressPercentage === undefined || typeof progressPercentage !== "number" || progressPercentage < 0 || progressPercentage > 100) {
    return "Invalid 'progressPercentage': Must be a number between 0 and 100.";
  }

  if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
    return "Invalid 'taskId': Must be a non-empty string identifier.";
  }

  if (!statusIdentifier || !VALID_STATUSES.includes(statusIdentifier)) {
    return `Invalid 'statusIdentifier': Must be one of ${VALID_STATUSES.join(", ")}.`;
  }

  return null;
};

/**
 * Helper to construct CSRF and Authorization headers from cookies or environment
 */
const getAuthHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (typeof document !== "undefined" && document.cookie) {
    const csrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (csrfMatch) {
      headers["x-xsrf-token"] = csrfMatch[1];
    }
  }

  return headers;
};

/**
 * Executes a single fetch request with AbortController timeout enforcement
 */
const fetchWithTimeout = async (url, fetchOptions, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms.`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw err;
  }
};

/**
 * Sends structured progress data objects to the backend system.
 *
 * @param {Object} progressData - Progress data payload
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.apiEndpoint='/api/teacher/progress'] - Endpoint URL
 * @param {number} [options.timeoutMs=10000] - Timeout limit in milliseconds
 * @param {number} [options.maxRetries=3] - Maximum retry attempts for transient failures
 * @param {number} [options.initialDelayMs=300] - Initial delay for exponential backoff
 * @param {Function} [options.onRetry] - Callback invoked on retry attempt (attempt, delayMs, err)
 * @returns {Promise<Object>} Response object
 */
export const sendProgressUpdate = async (progressData, options = {}) => {
  const {
    apiEndpoint = "/api/teacher/progress",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    onRetry,
    customFetch,
  } = options;

  // 1. Client-Side Schema Validation
  const validationError = validateProgressData(progressData);
  if (validationError) {
    const errObj = {
      success: false,
      error: "ValidationError",
      statusCode: 400,
      isRetryable: false,
      message: validationError,
    };
    return Promise.reject(errObj);
  }

  // Standardize payload metadata & timestamp
  const payload = {
    progressPercentage: progressData.progressPercentage,
    taskId: progressData.taskId.trim(),
    statusIdentifier: progressData.statusIdentifier,
    timestamp: progressData.timestamp || new Date().toISOString(),
    message: progressData.message ? String(progressData.message).trim() : "",
    metadata: {
      clientVersion: "1.0.0",
      deviceType: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "web",
      ...(progressData.metadata || {}),
    },
  };

  // 2. Request Deduplication: Hash key based on task + percentage + status
  const deduplicationHash = `${payload.taskId}:${payload.progressPercentage}:${payload.statusIdentifier}`;
  if (inFlightRequestsMap.has(deduplicationHash)) {
    console.warn(`[DEDUPLICATION] Returning existing in-flight request for '${deduplicationHash}'`);
    return inFlightRequestsMap.get(deduplicationHash);
  }

  // 3. Execution Engine with Exponential Backoff Retries
  const executeRequest = async () => {
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const fetcher = customFetch || ((url, opts) => fetchWithTimeout(url, opts, timeoutMs));
        const response = await fetcher(apiEndpoint, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok || response.status === 201) {
          return {
            success: true,
            statusCode: response.status,
            message: data.message || "Progress update recorded successfully.",
            data: data.data || data,
            attemptsMade: attempt,
          };
        }

        // Non-transient 4xx client errors (do not retry)
        if (response.status >= 400 && response.status < 500) {
          throw {
            success: false,
            error: data.error || "ClientError",
            statusCode: response.status,
            isRetryable: false,
            message: data.message || `Client error (${response.status})`,
          };
        }

        // 5xx Server errors are retryable
        throw {
          success: false,
          error: data.error || "ServerError",
          statusCode: response.status,
          isRetryable: true,
          message: data.message || `Server error (${response.status})`,
        };
      } catch (err) {
        const isNetworkError = err.name === "TypeError" || err.name === "FetchError" || !err.statusCode;
        const isTimeoutError = err.name === "TimeoutError";
        const isRetryable = err.isRetryable !== false && (isNetworkError || isTimeoutError || (err.statusCode >= 500));

        if (!isRetryable || attempt > maxRetries) {
          const finalError = {
            success: false,
            error: isTimeoutError ? "TimeoutError" : isNetworkError ? "NetworkError" : err.error || "RequestFailed",
            statusCode: err.statusCode || 0,
            isRetryable,
            message: isTimeoutError
              ? `Request timed out after ${timeoutMs}ms.`
              : isNetworkError
              ? "Network connectivity error or server unreachable."
              : err.message || "Progress update failed.",
            attemptsMade: attempt,
          };
          throw finalError;
        }

        // Exponential backoff delay: 300ms, 600ms, 1200ms...
        const backoffDelay = initialDelayMs * Math.pow(2, attempt - 1);
        if (typeof onRetry === "function") {
          onRetry(attempt, backoffDelay, err);
        }

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  };

  // Cache in-flight promise for deduplication
  const requestPromise = executeRequest().finally(() => {
    inFlightRequestsMap.delete(deduplicationHash);
  });

  inFlightRequestsMap.set(deduplicationHash, requestPromise);
  return requestPromise;
};
