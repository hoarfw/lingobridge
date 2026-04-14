/**
 * Retry with backoff - Retries an async operation with exponential backoff
 * @param {Function} asyncFn - The async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 1)
 * @param {number} options.delayMs - Initial delay in milliseconds (default: 1000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @returns {Promise<any>} - Result of asyncFn
 */
export async function retryWithBackoff(asyncFn, options = {}) {
  const {
    maxRetries = 1,
    delayMs = 1000,
    shouldRetry = () => true
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1}`);
      const result = await asyncFn();
      console.log(`[Retry] Success on attempt ${attempt + 1}`);
      return result;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt || !shouldRetry(error)) {
        console.log(`[Retry] Not retrying: ${isLastAttempt ? 'max retries reached' : 'error not retryable'}`);
        break;
      }

      // Calculate delay with exponential backoff
      const currentDelay = delayMs * Math.pow(2, attempt);
      console.log(`[Retry] Retrying in ${currentDelay}ms...`);
      await sleep(currentDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
