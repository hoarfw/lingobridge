import { ErrorCategories } from './error-categories.js';

/**
 * Get a user-friendly, actionable error message for a given error category
 * @param {string} errorCategory - One of ErrorCategories values
 * @param {Object} errorDetails - Additional error details
 * @returns {Object} - Object with title, message, and action
 */
export function getUserMessage(errorCategory, errorDetails = {}) {
  switch (errorCategory) {
    case ErrorCategories.CONNECTION_FAILED:
      return {
        title: 'Connection Failed',
        message: 'Unable to connect to Ollama server.',
        action: 'Start Ollama with: ollama serve'
      };

    case ErrorCategories.MODEL_NOT_FOUND:
      return {
        title: 'Model Not Found',
        message: `Model "${errorDetails.model || 'unknown'}" not found in Ollama.`,
        action: 'Pull the model with: ollama pull ' + (errorDetails.model || 'translategemma:4b')
      };

    case ErrorCategories.TIMEOUT:
      return {
        title: 'Translation Timed Out',
        message: 'The translation request took too long to complete.',
        action: 'Try again with a shorter text or check if Ollama is responsive'
      };

    case ErrorCategories.UNKNOWN:
    default:
      return {
        title: 'Translation Failed',
        message: 'An unexpected error occurred during translation.',
        action: 'Check that Ollama is running and try again'
      };
  }
}
