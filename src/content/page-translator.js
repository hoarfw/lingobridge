/**
 * PageTranslator - Orchestrates full page translation
 *
 * Coordinates paragraph detection, translation queue management,
 * and UI updates for translating entire web pages.
 */

import { TranslationQueue } from './translation-queue.js';
import { detectParagraphs, markTranslated } from './paragraph-detector.js';
import { ShadowRenderer } from './shadow-renderer.js';

/**
 * PageTranslator class for orchestrating page translation
 */
export class PageTranslator {
  /**
   * Create a new PageTranslator
   * @param {Object} options - Configuration options
   * @param {OllamaClient} options.ollamaClient - The Ollama client instance
   * @param {Function} options.onProgress - Progress callback
   * @param {Function} options.onComplete - Completion callback
   * @param {Function} options.onError - Error callback
   */
  constructor(options = {}) {
    this.ollamaClient = options.ollamaClient;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});

    this.queue = null;
    this.isTranslating = false;
    this.translatedCount = 0;
    this.failedCount = 0;
    this.translationHosts = new Map();
  }

  /**
   * Translate the entire page
   * @param {Object} options - Translation options
   * @param {Element} options.rootElement - Root element to translate (default: document.body)
   * @returns {Promise<void>}
   */
  async translatePage(options = {}) {
    if (this.isTranslating) {
      throw new Error('Translation already in progress');
    }

    this.isTranslating = true;
    this.translatedCount = 0;
    this.failedCount = 0;

    try {
      // Step 1: Detect paragraphs
      this.onProgress({ stage: 'detecting', message: 'Detecting translatable content...' });
      const paragraphs = this.detectParagraphs(options.rootElement);

      if (paragraphs.length === 0) {
        this.onComplete({ translated: 0, message: 'No translatable content found' });
        return;
      }

      this.onProgress({
        stage: 'detected',
        message: `Found ${paragraphs.length} paragraphs`,
        total: paragraphs.length
      });

      // Step 2: Create and configure queue
      this.queue = new TranslationQueue(this.ollamaClient, {
        concurrency: 1,
        delayBetween: 100,
        maxRetries: 2,
        onProgress: (data) => {
          // Render translation for completed items
          if (data.type === 'completed' && data.item) {
            this.renderTranslation(data.item);
            this.translatedCount++;
          }

          this.onProgress({
            stage: 'translating',
            message: `Translated ${this.translatedCount}/${data.total}`,
            ...data,
            translatedCount: this.translatedCount
          });
        },
        onComplete: (data) => {
          this.onComplete({
            stage: 'complete',
            message: `Translation complete: ${this.translatedCount} translated, ${this.failedCount} failed`,
            ...data,
            translatedCount: this.translatedCount,
            failedCount: this.failedCount
          });
        },
        onError: (data) => {
          this.failedCount++;
          this.onError({
            stage: 'error',
            message: `Translation error: ${data.error?.message || data.error}`,
            ...data
          });
        }
      });

      // Step 3: Add paragraphs and start translation
      this.queue.addParagraphs(paragraphs);
      await this.queue.start();

    } finally {
      this.isTranslating = false;
    }
  }

  /**
   * Detect paragraphs in the DOM
   * @param {Element} rootElement - Root element to search (default: document.body)
   * @returns {Array} - Array of paragraph objects
   */
  detectParagraphs(rootElement = document.body) {
    if (!rootElement) {
      rootElement = document.body;
    }

    return detectParagraphs(rootElement, {
      selectors: 'p, article, section, div',
      minLength: 20,
      skipHidden: true,
      skipTranslated: true
    });
  }

  /**
   * Render a translation for a completed item
   * @param {Object} item - The completed queue item
   */
  renderTranslation(item) {
    if (!item.element || !item.translation) {
      return;
    }

    try {
      // Use ShadowRenderer to create translation display
      const result = ShadowRenderer.renderTranslation(item.element, item.translation, {
        customStyles: ''
      });

      if (result && result.hostId) {
        this.translationHosts.set(item.id, {
          hostId: result.hostId,
          element: item.element,
          container: result.container
        });
      }

      // Mark the original element as translated
      markTranslated(item.element, item.id);

    } catch (error) {
      console.error('Failed to render translation:', error);
    }
  }

  /**
   * Pause the translation
   */
  pause() {
    if (this.queue) {
      this.queue.pause();
    }
  }

  /**
   * Resume the translation
   */
  resume() {
    if (this.queue) {
      this.queue.resume();
    }
  }

  /**
   * Get current translation progress
   * @returns {Object} - Progress statistics
   */
  getProgress() {
    if (!this.queue) {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
        translatedCount: this.translatedCount,
        isTranslating: this.isTranslating
      };
    }

    const stats = this.queue.getStats();
    return {
      ...stats,
      translatedCount: this.translatedCount,
      failedCount: this.failedCount,
      isTranslating: this.isTranslating
    };
  }

  /**
   * Clear all translations from the page
   * @returns {number} - Number of translations cleared
   */
  clearTranslations() {
    let count = 0;

    for (const [itemId, hostInfo] of this.translationHosts) {
      if (hostInfo.hostId) {
        const removed = ShadowRenderer.removeHost(hostInfo.hostId);
        if (removed) {
          count++;
        }
      }
    }

    this.translationHosts.clear();
    return count;
  }
}

export default PageTranslator;