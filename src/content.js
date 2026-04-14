import { ShadowDOMManager } from './content/shadow-dom-manager.js';
import { TranslationDisplay } from './content/translation-display.js';
import { ProgressIndicator } from './content/progress-indicator.js';
import { ErrorDisplay } from './content/error-display.js';
import { translateWithProgress } from './content/translation-flow.js';

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-CS ${ts}] [${tag}]`, 'color:#e0c;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-CS ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

// Message types
const MESSAGE_TYPES = {
  TRIGGER_TRANSLATION: 'TRIGGER_TRANSLATION',
  GET_SELECTED_TEXT: 'GET_SELECTED_TEXT',
  TRANSLATE: 'TRANSLATE',
  TEST_CONNECTION: 'TEST_CONNECTION'
};

// Track active translations
const activeTranslations = new Map();

/**
 * Get the currently selected text and element info
 * @returns {Object} - Object with text and elementInfo
 */
function getSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: '', elementInfo: null };
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();

  if (!text) {
    return { text: '', elementInfo: null };
  }

  // Get the parent element of the selection
  let container = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement;
  }

  const elementInfo = {
    tagName: container.tagName,
    id: container.id || null,
    className: container.className || null,
    xpath: getXPath(container)
  };

  return { text, elementInfo, container };
}

/**
 * Get XPath for an element
 * @param {Element} element - The element
 * @returns {string} - XPath string
 */
function getXPath(element) {
  if (!element) return '';
  if (element.id) return `//*[@id="${element.id}"]`;

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousSibling;

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tagName = current.tagName.toLowerCase();
    parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName);

    current = current.parentNode;
  }

  return parts.length ? '/' + parts.join('/') : '';
}

/**
 * Handle translation of selected text
 * @param {string} text - The text to translate
 * @param {Element} targetElement - The element to insert translation after
 */
async function translateSelection(text, targetElement) {
  const translationId = `translation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  dbg('TRANSLATE', 'Starting translation:', text.substring(0, 100), 'target:', targetElement?.tagName);

  try {
    // Track this translation
    activeTranslations.set(translationId, {
      text,
      startTime: Date.now()
    });

    // Use the translation flow which handles progress, API call, and display
    await translateWithProgress(text, targetElement);
    dbg('TRANSLATE', 'Translation completed successfully');

  } catch (error) {
    dbgErr('TRANSLATE', 'Translation failed:', error.message);
    // Error display is handled by translateWithProgress
  } finally {
    activeTranslations.delete(translationId);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dbg('MSG', 'Received:', message.type);

  const handleAsync = async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.GET_SELECTED_TEXT:
          const result = getSelectedText();
          dbg('MSG', 'GET_SELECTED_TEXT:', result.text?.substring(0, 80), 'hasSelection:', !!result.text);
          return {
            text: result.text,
            elementInfo: result.elementInfo,
            hasSelection: !!result.text
          };

        case MESSAGE_TYPES.TRIGGER_TRANSLATION:
          dbg('MSG', 'TRIGGER_TRANSLATION:', message.text?.substring(0, 80));
          if (message.text) {
            // If container info is provided, find the element
            let targetElement = null;
            if (message.elementInfo?.xpath) {
              try {
                const xpathResult = document.evaluate(
                  message.elementInfo.xpath,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                );
                targetElement = xpathResult.singleNodeValue;
                dbg('MSG', 'XPath resolved:', !!targetElement);
              } catch (e) {
                dbgErr('MSG', 'XPath failed:', e.message);
              }
            }

            // If no element found, use current selection
            if (!targetElement) {
              const currentSelection = getSelectedText();
              targetElement = currentSelection.container;
              dbg('MSG', 'Using current selection container:', targetElement?.tagName);
            }

            // Fall back to document.body if still no target
            if (!targetElement) {
              targetElement = document.body;
              dbg('MSG', 'Falling back to document.body');
            }

            await translateSelection(message.text, targetElement);
          }
          return { success: true };

        default:
          dbgErr('MSG', 'Unknown message type:', message.type);
          return { error: 'Unknown message type: ' + message.type };
      }
    } catch (error) {
      dbgErr('MSG', 'Content script error:', error);
      return { error: error.message };
    }
  };

  handleAsync().then(response => {
    dbg('MSG', 'Sending response:', message.type, response);
    sendResponse(response);
  }).catch(error => {
    dbgErr('MSG', 'Fatal:', error);
    sendResponse({ error: error.message });
  });
  return true; // Keep channel open for async
});

dbg('INIT', 'Content script initialized');
