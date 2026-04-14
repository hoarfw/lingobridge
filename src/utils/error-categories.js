/**
 * ErrorCategories - Constants for different types of errors
 */
export const ErrorCategories = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Categorize an error based on its type and message
 * @param {Error} error - The error to categorize
 * @returns {string} - One of the ErrorCategories values
 */
export function categorizeError(error) {
  if (!error) {
    return ErrorCategories.UNKNOWN;
  }

  const message = error.message || '';
  const errorType = error.name || '';

  // Check for timeout errors
  if (
    errorType === 'AbortError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('AbortError')
  ) {
    return ErrorCategories.TIMEOUT;
  }

  // Check for HTTP 404 errors (model not found)
  if (
    error.status === 404 ||
    message.includes('404') ||
    message.includes('Not Found') ||
    message.includes('model not found')
  ) {
    return ErrorCategories.MODEL_NOT_FOUND;
  }

  // Check for connection errors
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('fetch failed') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network error') ||
    message.includes('connect') ||
    errorType === 'TypeError' // Fetch throws TypeError for network failures
  ) {
    return ErrorCategories.CONNECTION_FAILED;
  }

  // Default to unknown
  return ErrorCategories.UNKNOWN;
}
