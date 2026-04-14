import { ProgressIndicator } from './progress-indicator.js';
import { TranslationDisplay } from './translation-display.js';
import { ErrorDisplay } from './error-display.js';

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-FLOW ${ts}] [${tag}]`, 'color:#0cf;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-FLOW ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

/**
 * Translation flow - Orchestrates the full translation process:
 * show progress → call API → display result/error → hide progress
 * @param {string} text - The text to translate
 * @param {Element} targetElement - The element to display translation after
 * @returns {Promise<string>} - The translated text
 */
export async function translateWithProgress(text, targetElement) {
  let progressId = null;

  dbg('FLOW', 'Starting translation flow, text:', text.substring(0, 80));

  try {
    // Show progress indicator
    progressId = ProgressIndicator.show(targetElement);
    dbg('FLOW', 'Progress indicator shown, id:', progressId);

    // Send translation request to background script
    dbg('FLOW', 'Sending TRANSLATE message to background...');
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'TRANSLATE',
          text: text
        },
        (response) => {
          if (chrome.runtime.lastError) {
            dbgErr('FLOW', 'sendMessage lastError:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            dbgErr('FLOW', 'Translation error response:', response.error);
            const error = new Error(response.error);
            if (response.errorCategory) {
              error.category = response.errorCategory;
            }
            reject(error);
          } else {
            dbg('FLOW', 'Translation response received:', response?.translation?.substring(0, 80));
            resolve(response);
          }
        }
      );
    });

    // Hide progress indicator
    if (progressId) {
      ProgressIndicator.hide(progressId);
      progressId = null;
    }

    // Display the translation
    if (response?.translation) {
      dbg('FLOW', 'Displaying translation result');
      TranslationDisplay.render(response.translation, targetElement);
      return response.translation;
    } else {
      throw new Error('No translation received');
    }

  } catch (error) {
    dbgErr('FLOW', 'Translation flow error:', error.message);

    // Hide progress indicator (if still showing)
    if (progressId) {
      ProgressIndicator.hide(progressId);
      progressId = null;
    }

    // Display the error
    ErrorDisplay.display(error, targetElement);

    // Re-throw for upstream handling
    throw error;
  }
}
