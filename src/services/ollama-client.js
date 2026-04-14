import { categorizeError, ErrorCategories } from "../utils/error-categories.js";
import { retryWithBackoff } from "../utils/retry.js";

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-CLIENT ${ts}] [${tag}]`, 'color:#fa0;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-CLIENT ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

/**
 * Error classification for translation operations
 */
export const TranslationErrorType = {
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  MODEL_ERROR: "MODEL_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  UNKNOWN: "UNKNOWN",
};

/**
 * Classify an error into translation error types
 * @param {Error} error - The error to classify
 * @returns {Object} - Error type and whether it's retryable
 */
function classifyTranslationError(error) {
  if (!error) {
    return { type: TranslationErrorType.UNKNOWN, retryable: false };
  }

  const message = error.message || "";
  const errorType = error.name || "";
  const status = error.status;

  // Check for timeout errors
  if (
    errorType === "AbortError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("AbortError")
  ) {
    return { type: TranslationErrorType.TIMEOUT_ERROR, retryable: true };
  }

  // Check for network/connection errors
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network error") ||
    errorType === "TypeError"
  ) {
    return { type: TranslationErrorType.NETWORK_ERROR, retryable: true };
  }

  // Check for model errors (HTTP 404 or specific model errors)
  if (
    status === 404 ||
    message.includes("404") ||
    message.includes("Not Found") ||
    message.includes("model not found") ||
    message.includes("model is required")
  ) {
    return { type: TranslationErrorType.MODEL_ERROR, retryable: false };
  }

  // Check for invalid responses
  if (
    message.includes("Invalid response") ||
    message.includes("Malformed") ||
    message.includes("Unexpected token")
  ) {
    return { type: TranslationErrorType.INVALID_RESPONSE, retryable: false };
  }

  return { type: TranslationErrorType.UNKNOWN, retryable: false };
}

/**
 * OllamaClient - HTTP client for communicating with local Ollama server
 */
export class OllamaClient {
  constructor(config = {}) {
    this.url = config.url || "http://localhost:11434";
    this.model = config.model || "translategemma:4b";
    this.timeout = config.timeout || 30000; // 30 seconds
  }

  /**
   * Generate a translation for the given text
   * @param {string} text - The text to translate
   * @returns {Promise<string>} - The translated text
   */
  async generate(text) {
    dbg('GEN', 'Starting generate, model:', this.model, 'url:', this.url);
    dbg('GEN', 'Input text:', text.substring(0, 100));

    const operation = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const fetchUrl = `${this.url}/api/generate`;
        const body = JSON.stringify({
          model: this.model,
          prompt: `Translate the following text to chinese:\n\n${text}`,
          stream: false,
        });
        dbg('GEN', 'POST', fetchUrl, 'body length:', body.length);

        const response = await fetch(fetchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        dbg('GEN', 'Response status:', response.status, response.statusText);

        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}`,
          );
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        dbg('GEN', 'Response data.response length:', data.response?.length);
        return data.response?.trim() || "";
      } catch (fetchError) {
        clearTimeout(timeoutId);
        dbgErr('GEN', 'Fetch error:', fetchError.name, fetchError.message);
        throw fetchError;
      }
    };

    try {
      // Use retry with backoff, but only retry on CONNECTION_FAILED
      return await retryWithBackoff(operation, {
        maxRetries: 1,
        delayMs: 1000,
        shouldRetry: (error) => {
          const category = categorizeError(error);
          return category === ErrorCategories.CONNECTION_FAILED;
        },
      });
    } catch (error) {
      // Enhance error with category for better handling upstream
      error.category = categorizeError(error);
      throw error;
    }
  }

  /**
   * Test connection to Ollama server
   * @returns {Promise<boolean>} - True if connection successful
   */
  async testConnection() {
    dbg('TEST', 'Fetching:', `${this.url}/api/tags`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for test

    try {
      const response = await fetch(`${this.url}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      dbg('TEST', 'Response status:', response.status, response.statusText);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      dbgErr('TEST', 'Connection failed:', error.name, error.message);
      return false;
    }
  }

  /**
   * Translate a single paragraph - optimized for paragraph-sized text
   * @param {string} text - The paragraph text to translate
   * @param {Object} options - Translation options
   * @param {number} options.timeout - Request timeout in ms (default: 30000)
   * @param {number} options.maxRetries - Max retries for retryable errors (default: 2)
   * @returns {Promise<Object>} - Translation result with text, timing, and metadata
   */
  async translateParagraph(text, options = {}) {
    const config = {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
    };

    const startTime = performance.now();
    let attempts = 0;
    let lastError = null;

    while (attempts <= config.maxRetries) {
      attempts++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(`${this.url}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            prompt: `Translate the following text to English:\n\n${text}`,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}`,
          );
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        const translation = data.response?.trim() || "";

        // Validate response
        if (!translation) {
          throw new Error("Invalid response: Empty translation received");
        }

        const endTime = performance.now();

        return {
          translation,
          originalText: text,
          duration: Math.round(endTime - startTime),
          attempts,
          success: true,
          model: this.model,
        };
      } catch (error) {
        lastError = error;
        const errorClassification = classifyTranslationError(error);

        // Don't retry if error is not retryable
        if (!errorClassification.retryable || attempts > config.maxRetries) {
          break;
        }

        // Wait before retrying
        const delay = config.retryDelay * Math.pow(2, attempts - 1);
        await sleep(delay);
      }
    }

    // All retries exhausted - return error result
    const errorClassification = classifyTranslationError(lastError);
    const endTime = performance.now();

    return {
      translation: null,
      originalText: text,
      duration: Math.round(endTime - startTime),
      attempts,
      success: false,
      error: lastError?.message || "Unknown error",
      errorType: errorClassification.type,
      retryable: errorClassification.retryable,
    };
  }
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
