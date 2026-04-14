import { categorizeError, ErrorCategories } from "../utils/error-categories.js";
import { retryWithBackoff } from "../utils/retry.js";

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-OAI ${ts}] [${tag}]`, 'color:#f0f;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-OAI ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

/**
 * OpenAIClient - HTTP client for OpenAI-compatible chat completions API
 * Works with: OpenAI, Azure OpenAI, LM Studio, Ollama (OpenAI compat), etc.
 */
export class OpenAIClient {
  constructor(config = {}) {
    this.url = (config.url || "https://api.openai.com").replace(/\/+$/, "");
    this.model = config.model || "gpt-4o-mini";
    this.apiKey = config.apiKey || "";
    this.timeout = config.timeout || 30000;
  }

  /**
   * Build request headers
   * @returns {Object}
   */
  _headers() {
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
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
        const fetchUrl = `${this.url}/v1/chat/completions`;
        const body = JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are a translator. Translate the given text to Chinese. Reply with only the translation, nothing else." },
            { role: "user", content: text }
          ],
          temperature: 0.3,
          stream: false,
        });
        dbg('GEN', 'POST', fetchUrl, 'body length:', body.length);

        const response = await fetch(fetchUrl, {
          method: "POST",
          headers: this._headers(),
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        dbg('GEN', 'Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText} ${errorText}`.trim()
          );
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        dbg('GEN', 'Response content length:', content.length);
        return content;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        dbgErr('GEN', 'Fetch error:', fetchError.name, fetchError.message);
        throw fetchError;
      }
    };

    try {
      return await retryWithBackoff(operation, {
        maxRetries: 1,
        delayMs: 1000,
        shouldRetry: (error) => {
          const category = categorizeError(error);
          return category === ErrorCategories.CONNECTION_FAILED;
        },
      });
    } catch (error) {
      error.category = categorizeError(error);
      throw error;
    }
  }

  /**
   * Test connection by listing models
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    const fetchUrl = `${this.url}/v1/models`;
    dbg('TEST', 'Fetching:', fetchUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: this._headers(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      dbg('TEST', 'Response status:', response.status);
      return response.ok;
    } catch (error) {
      clearTimeout(timeoutId);
      dbgErr('TEST', 'Connection failed:', error.name, error.message);
      return false;
    }
  }

  /**
   * Translate a single paragraph (same as generate, returns enriched result)
   * @param {string} text
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async translateParagraph(text, options = {}) {
    const startTime = performance.now();

    try {
      const translation = await this.generate(text);
      const endTime = performance.now();

      if (!translation) {
        throw new Error("Invalid response: Empty translation received");
      }

      return {
        translation,
        originalText: text,
        duration: Math.round(endTime - startTime),
        attempts: 1,
        success: true,
        model: this.model,
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        translation: null,
        originalText: text,
        duration: Math.round(endTime - startTime),
        attempts: 1,
        success: false,
        error: error.message,
      };
    }
  }
}
