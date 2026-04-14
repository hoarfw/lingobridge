/**
 * Paragraph Detector - Identifies translatable text blocks in the DOM
 *
 * Uses TreeWalker for efficient DOM traversal to find paragraphs,
 * articles, and other text containers suitable for translation.
 */

/**
 * Default options for paragraph detection
 */
const DEFAULT_OPTIONS = {
  selectors: 'p, article, section, div',
  minLength: 20,
  skipHidden: true,
  skipTranslated: true,
  skipSelectors: 'script, style, noscript, iframe, canvas, svg, code, pre',
};

/**
 * Check if an element is visible (not display:none or visibility:hidden)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if the element is visible
 */
function isVisible(element) {
  if (!element) return false;

  // Check computed style
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  // Check if element has dimensions (except for inline elements)
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && style.display !== 'contents') {
    // Allow elements that might have content through pseudo-elements
    return element.textContent?.trim().length > 0;
  }

  return true;
}

/**
 * Check if an element should be skipped
 * @param {Element} element - The element to check
 * @param {Object} options - Detection options
 * @returns {boolean} - True if the element should be skipped
 */
function shouldSkipElement(element, options) {
  if (!element) return true;

  // Skip if already translated
  if (options.skipTranslated && element.hasAttribute('data-tg-translated')) {
    return true;
  }

  // Skip if matches skip selectors
  if (options.skipSelectors) {
    const skipElements = element.closest?.(options.skipSelectors);
    if (skipElements) {
      return true;
    }
  }

  // Skip hidden elements
  if (options.skipHidden && !isVisible(element)) {
    return true;
  }

  // Skip if no text content or too short
  const text = element.textContent?.trim() || '';
  if (text.length < options.minLength) {
    return true;
  }

  // Skip if element only contains another block element (avoid duplicates)
  const childBlockElements = element.querySelectorAll('p, article, section, div');
  for (const child of childBlockElements) {
    if (child.textContent?.trim() === text) {
      return true;
    }
  }

  return false;
}

/**
 * Extract clean text from an element
 * @param {Element} element - The element to extract text from
 * @returns {string} - Clean text content
 */
function extractText(element) {
  if (!element) return '';

  // Clone to avoid modifying original
  const clone = element.cloneNode(true);

  // Remove script, style, and other non-content elements
  const scripts = clone.querySelectorAll('script, style, noscript, iframe');
  scripts.forEach(s => s.remove());

  return clone.textContent?.trim() || '';
}

/**
 * Main detection function - finds translatable paragraphs in the DOM
 * @param {Element} rootElement - Root element to search within (default: document.body)
 * @param {Object} options - Detection options
 * @returns {Array} - Array of {element, text} objects
 */
export function detectParagraphs(rootElement = document.body, options = {}) {
  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Default to document.body if no root provided
  if (!rootElement) {
    rootElement = document.body;
  }

  const paragraphs = [];
  const processedElements = new Set();

  try {
    // Use TreeWalker for efficient DOM traversal
    const treeWalker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Only consider element nodes
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return NodeFilter.FILTER_SKIP;
          }

          // Check if element matches our selectors
          const matchesSelector = config.selectors
            .split(',')
            .some(sel => node.matches?.(sel.trim()));

          if (!matchesSelector) {
            return NodeFilter.FILTER_SKIP;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Process matching elements
    let node;
    while ((node = treeWalker.nextNode())) {
      // Skip if already processed
      if (processedElements.has(node)) {
        continue;
      }

      // Skip if element should be skipped
      if (shouldSkipElement(node, config)) {
        continue;
      }

      // Extract text
      const text = extractText(node);

      // Skip if no valid text
      if (!text || text.length < config.minLength) {
        continue;
      }

      // Add to results
      paragraphs.push({
        element: node,
        text: text,
        id: `tg-para-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });

      processedElements.add(node);
    }
  } catch (error) {
    console.error('Paragraph detector error:', error);
  }

  return paragraphs;
}

/**
 * Mark an element as translated
 * @param {Element} element - The element to mark
 * @param {string} translationId - Optional translation ID for reference
 */
export function markTranslated(element, translationId = null) {
  if (!element) return;

  element.setAttribute('data-tg-translated', 'true');

  if (translationId) {
    element.setAttribute('data-tg-translation-id', translationId);
  }
}

/**
 * Check if an element has been translated
 * @param {Element} element - The element to check
 * @returns {boolean} - True if the element has been translated
 */
export function isTranslated(element) {
  return element?.hasAttribute('data-tg-translated') || false;
}

/**
 * Get all translated elements within a root
 * @param {Element} rootElement - Root element to search (default: document.body)
 * @returns {Array} - Array of translated elements
 */
export function getTranslatedElements(rootElement = document.body) {
  if (!rootElement) return [];

  return Array.from(rootElement.querySelectorAll('[data-tg-translated="true"]'));
}

/**
 * Clear all translation marks from elements
 * @param {Element} rootElement - Root element to search (default: document.body)
 * @returns {number} - Number of elements cleared
 */
export function clearTranslationMarks(rootElement = document.body) {
  if (!rootElement) return 0;

  const elements = getTranslatedElements(rootElement);
  let count = 0;

  for (const element of elements) {
    element.removeAttribute('data-tg-translated');
    element.removeAttribute('data-tg-translation-id');
    count++;
  }

  return count;
}
