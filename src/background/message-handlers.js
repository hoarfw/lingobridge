/**
 * Message Handlers - Background script message handling
 *
 * Handles messages from content scripts for page translation operations.
 */

import { StateManager } from '../utils/state-manager.js';

// Message types
export const MESSAGE_TYPES = {
  // Existing types
  TRANSLATE: 'TRANSLATE',
  TEST_CONNECTION: 'TEST_CONNECTION',
  GET_SELECTED_TEXT: 'GET_SELECTED_TEXT',
  TRIGGER_TRANSLATION: 'TRIGGER_TRANSLATION',

  // Page translation types
  TRANSLATE_PAGE: 'TRANSLATE_PAGE',
  GET_TRANSLATION_PROGRESS: 'GET_TRANSLATION_PROGRESS',
  PAUSE_TRANSLATION: 'PAUSE_TRANSLATION',
  RESUME_TRANSLATION: 'RESUME_TRANSLATION',
  CLEAR_TRANSLATIONS: 'CLEAR_TRANSLATIONS'
};

/**
 * Ensure content script is injected in a tab
 * @param {number} tabId - The tab ID
 * @returns {Promise<void>}
 */
async function ensureContentScript(tabId) {
  try {
    // Test if content script is already loaded by pinging it
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch (error) {
    // Content script not loaded, inject it
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

/**
 * Get settings from storage
 * @returns {Promise<Object>}
 */
async function getSettings() {
  return await StateManager.get(['ollamaUrl', 'modelName', 'targetLanguage']);
}

/**
 * Handle TRANSLATE_PAGE message
 * @param {Object} message - The message
 * @param {Object} sender - The sender
 * @returns {Promise<Object>}
 */
async function handleTranslatePage(message, sender) {
  const { tabId } = message;

  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    // Ensure content script is present
    await ensureContentScript(tabId);

    // Send message to content script to start translation
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'START_PAGE_TRANSLATION',
      settings: await getSettings()
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('Failed to translate page:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle GET_TRANSLATION_PROGRESS message
 * @param {Object} message - The message
 * @param {Object} sender - The sender
 * @returns {Promise<Object>}
 */
async function handleGetProgress(message, sender) {
  const { tabId } = message;

  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    const progress = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_TRANSLATION_PROGRESS'
    });
    return { success: true, data: progress };
  } catch (error) {
    console.error('Failed to get progress:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle PAUSE_TRANSLATION message
 * @param {Object} message - The message
 * @param {Object} sender - The sender
 * @returns {Promise<Object>}
 */
async function handlePauseTranslation(message, sender) {
  const { tabId } = message;

  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PAUSE_TRANSLATION' });
    return { success: true };
  } catch (error) {
    console.error('Failed to pause translation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle RESUME_TRANSLATION message
 * @param {Object} message - The message
 * @param {Object} sender - The sender
 * @returns {Promise<Object>}
 */
async function handleResumeTranslation(message, sender) {
  const { tabId } = message;

  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'RESUME_TRANSLATION' });
    return { success: true };
  } catch (error) {
    console.error('Failed to resume translation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle CLEAR_TRANSLATIONS message
 * @param {Object} message - The message
 * @param {Object} sender - The sender
 * @returns {Promise<Object>}
 */
async function handleClearTranslations(message, sender) {
  const { tabId } = message;

  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_TRANSLATIONS' });
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to clear translations:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Setup message handlers for the background script
 * Call this function in background.js to register all handlers
 */
export function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Always return true for async operations
    const handleAsync = async () => {
      try {
        switch (message.type) {
          // Page translation handlers
          case MESSAGE_TYPES.TRANSLATE_PAGE:
            return await handleTranslatePage(message, sender);
          case MESSAGE_TYPES.GET_TRANSLATION_PROGRESS:
            return await handleGetProgress(message, sender);
          case MESSAGE_TYPES.PAUSE_TRANSLATION:
            return await handlePauseTranslation(message, sender);
          case MESSAGE_TYPES.RESUME_TRANSLATION:
            return await handleResumeTranslation(message, sender);
          case MESSAGE_TYPES.CLEAR_TRANSLATIONS:
            return await handleClearTranslations(message, sender);

          // Default
          default:
            // Return null to let other handlers process
            return null;
        }
      } catch (error) {
        console.error('Message handler error:', error);
        return { success: false, error: error.message };
      }
    };

    const result = handleAsync();

    // Only handle if this handler knows the message type
    if (Object.values(MESSAGE_TYPES).includes(message.type)) {
      result.then(sendResponse);
      return true; // Keep channel open for async
    }

    // Let other handlers process unknown message types
    return false;
  });
}

export default {
  setupMessageHandlers,
  MESSAGE_TYPES
};