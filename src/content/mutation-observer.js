/**
 * TranslationMutationObserver - Detects new paragraphs added to DOM for SPA support
 *
 * This class uses MutationObserver to watch for dynamically added content
 * and notifies when new paragraphs are detected for translation.
 */
class TranslationMutationObserver {
  constructor(options = {}) {
    this.onNewParagraphs = options.onNewParagraphs || (() => {});
    this.onError = options.onError || (() => {});
    this.debounceMs = options.debounceMs || 500;
    this.excludeSelectors = options.excludeSelectors || ['script', 'style', 'noscript', 'iframe', 'nav', 'header[role="banner"]', 'footer[role="contentinfo"]', '[data-tg-translated]'];

    this.observer = null;
    this.debounceTimer = null;
    this.processedElements = new WeakSet();
    this.isObserving = false;
  }

  /**
   * Start observing mutations on the target node
   * @param {Node} targetNode - The node to observe (defaults to document.body)
   */
  start(targetNode = document.body) {
    if (this.isObserving) {
      console.warn('[TranslationMutationObserver] Already running');
      return;
    }

    if (!targetNode || !(targetNode instanceof Node)) {
      const error = new Error('Invalid target node provided');
      this.onError({ type: 'INVALID_TARGET', error });
      return;
    }

    try {
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });

      this.observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      this.isObserving = true;
      console.log('[TranslationMutationObserver] Started observing');
    } catch (error) {
      this.onError({ type: 'START_ERROR', error });
    }
  }

  /**
   * Handle mutation records and extract new paragraphs
   * @param {MutationRecord[]} mutations - Array of mutation records
   */
  handleMutations(mutations) {
    const newParagraphs = [];

    mutations.forEach(mutation => {
      // Handle added nodes
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const paragraphs = this.extractParagraphs(node);
          paragraphs.forEach(p => {
            if (!this.processedElements.has(p)) {
              newParagraphs.push(p);
              this.processedElements.add(p);
            }
          });
        }
      });
    });

    if (newParagraphs.length > 0) {
      this.debounceAndNotify(newParagraphs);
    }
  }

  /**
   * Extract paragraph elements from a root node
   * @param {Element} root - The root element to search
   * @returns {Element[]} Array of paragraph elements
   */
  extractParagraphs(root) {
    const paragraphs = [];

    // Check if root itself is a paragraph
    if (this.isParagraphElement(root)) {
      paragraphs.push(root);
    }

    // Check children (avoid deep traversal for performance)
    const candidates = root.querySelectorAll('p, article, section, div, [class*="content"], [class*="text"]');
    candidates.forEach(el => {
      if (this.isParagraphElement(el)) {
        paragraphs.push(el);
      }
    });

    return paragraphs;
  }

  /**
   * Check if an element qualifies as a paragraph for translation
   * @param {Element} el - The element to check
   * @returns {boolean} True if the element is a paragraph
   */
  isParagraphElement(el) {
    // Skip excluded elements
    if (this.excludeSelectors.some(sel => el.matches(sel))) {
      return false;
    }

    // Skip hidden elements
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    // Check text content length (min 20 characters for meaningful content)
    const text = el.textContent.trim();
    if (text.length < 20) {
      return false;
    }

    // Skip already translated elements
    if (el.hasAttribute('data-tg-translated') || el.closest('[data-tg-translated]')) {
      return false;
    }

    // Skip navigation, header, footer areas by common patterns
    const parent = el.closest('nav, header[role="banner"], footer[role="contentinfo"], [role="navigation"]');
    if (parent) {
      return false;
    }

    return true;
  }

  /**
   * Debounce notification and notify of new paragraphs
   * @param {Element[]} paragraphs - Array of new paragraph elements
   */
  debounceAndNotify(paragraphs) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.onNewParagraphs({
        paragraphs,
        count: paragraphs.length,
        timestamp: Date.now()
      });
    }, this.debounceMs);
  }

  /**
   * Stop observing mutations and cleanup
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    clearTimeout(this.debounceTimer);
    this.isObserving = false;
    console.log('[TranslationMutationObserver] Stopped');
  }

  /**
   * Check if the observer is currently running
   * @returns {boolean} True if observing
   */
  isRunning() {
    return this.isObserving;
  }
}

export default TranslationMutationObserver;
