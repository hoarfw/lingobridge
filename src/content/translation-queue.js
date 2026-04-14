/**
 * TranslationQueue - Manages sequential paragraph translation processing
 *
 * Handles queuing, batching, and sequential processing of paragraphs
 * to respect Ollama's concurrency limits and provide progress feedback.
 */

/**
 * TranslationQueue class for managing paragraph translation
 */
export class TranslationQueue {
  /**
   * Create a new TranslationQueue
   * @param {OllamaClient} ollamaClient - The Ollama client instance
   * @param {Object} options - Queue configuration options
   * @param {number} options.concurrency - Max concurrent translations (default: 1)
   * @param {number} options.delayBetween - Delay between batches in ms (default: 100)
   * @param {number} options.maxRetries - Max retries for failed items (default: 2)
   * @param {Function} options.onProgress - Progress callback
   * @param {Function} options.onComplete - Completion callback
   * @param {Function} options.onError - Error callback
   * @param {HistoryStorage} options.historyStorage - Optional history storage for logging
   */
  constructor(ollamaClient, options = {}) {
    this.ollama = ollamaClient;
    this.concurrency = options.concurrency || 1; // Sequential for Ollama
    this.delayBetween = options.delayBetween || 100; // ms
    this.maxRetries = options.maxRetries || 2;

    this.queue = []; // Pending items
    this.processing = new Map(); // Currently processing
    this.completed = new Map(); // Completed translations
    this.failed = new Map(); // Failed after retries

    this.isRunning = false;
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.historyStorage = options.historyStorage || null;
  }

  /**
   * Add paragraphs to the translation queue
   * @param {Array} paragraphs - Array of paragraph objects with element and text
   * @returns {TranslationQueue} - This instance for chaining
   */
  addParagraphs(paragraphs) {
    for (const p of paragraphs) {
      // Skip if already in queue
      if (this.queue.find(item => item.element === p.element)) {
        continue;
      }
      // Skip if already processing
      if (this.processing.has(this.getElementId(p.element))) {
        continue;
      }
      // Skip if already completed
      if (this.completed.has(this.getElementId(p.element))) {
        continue;
      }

      this.queue.push({
        id: this.generateId(),
        element: p.element,
        text: p.text || p.element.textContent.trim(),
        status: 'pending',
        attempts: 0,
        error: null,
        translation: null,
        startTime: null,
        endTime: null
      });
    }
    return this;
  }

  /**
   * Start processing the queue
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      while (this.hasPending()) {
        const batch = this.getNextBatch();
        await this.processBatch(batch);

        if (this.delayBetween > 0 && this.hasPending()) {
          await this.delay(this.delayBetween);
        }
      }
    } finally {
      this.isRunning = false;
      this.onComplete({
        completed: this.completed.size,
        failed: this.failed.size,
        total: this.queue.length
      });
    }
  }

  /**
   * Check if there are pending items
   * @returns {boolean}
   */
  hasPending() {
    return this.queue.some(item => item.status === 'pending');
  }

  /**
   * Get the next batch of items to process
   * @returns {Array}
   */
  getNextBatch() {
    return this.queue
      .filter(item => item.status === 'pending')
      .slice(0, this.concurrency);
  }

  /**
   * Process a batch of items
   * @param {Array} batch - Array of items to process
   */
  async processBatch(batch) {
    await Promise.all(batch.map(item => this.processItem(item)));
  }

  /**
   * Process a single item
   * @param {Object} item - The item to process
   */
  async processItem(item) {
    item.status = 'processing';
    item.attempts++;
    item.startTime = performance.now();
    this.processing.set(item.id, item);

    try {
      const result = await this.ollama.translateParagraph(item.text, {
        timeout: 30000,
        maxRetries: 0 // Handle retries in queue
      });

      item.endTime = performance.now();

      if (result.success) {
        item.translation = result.translation;
        item.status = 'completed';
        this.completed.set(item.id, item);
        this.processing.delete(item.id);

        // Log to history storage if available
        if (this.historyStorage) {
          this.historyStorage.addEntry({
            originalText: item.text,
            translatedText: item.translation,
            url: typeof window !== 'undefined' ? window.location.href : 'unknown',
            timestamp: Date.now(),
            language: 'auto',
            charCount: item.text.length,
            duration: item.endTime - item.startTime
          }).catch(error => {
            console.error('Failed to log translation to history:', error);
          });
        }

        this.onProgress({
          type: 'completed',
          item,
          completed: this.completed.size,
          total: this.queue.length
        });
      } else {
        // Handle failure from translateParagraph
        throw new Error(result.error || 'Translation failed');
      }
    } catch (error) {
      item.endTime = performance.now();
      item.error = error.message;

      if (item.attempts < this.maxRetries) {
        item.status = 'pending'; // Retry
        this.processing.delete(item.id);

        this.onProgress({
          type: 'retry',
          item,
          attempt: item.attempts,
          maxRetries: this.maxRetries
        });
      } else {
        item.status = 'failed';
        this.failed.set(item.id, item);
        this.processing.delete(item.id);

        this.onError({ item, error });
        this.onProgress({
          type: 'failed',
          item,
          failed: this.failed.size,
          total: this.queue.length
        });
      }
    }
  }

  /**
   * Pause the queue processing
   */
  pause() {
    this.isRunning = false;
  }

  /**
   * Resume the queue processing
   */
  resume() {
    if (!this.isRunning && this.hasPending()) {
      this.start();
    }
  }

  /**
   * Clear the queue and reset state
   */
  clear() {
    this.queue = [];
    this.processing.clear();
    this.completed.clear();
    this.failed.clear();
    this.isRunning = false;
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getStats() {
    return {
      pending: this.queue.filter(i => i.status === 'pending').length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total: this.queue.length
    };
  }

  /**
   * Generate a unique ID for queue items
   * @returns {string}
   */
  generateId() {
    return 'tgq-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get an ID for an element
   * @param {Element} element - The DOM element
   * @returns {string}
   */
  getElementId(element) {
    if (!element) return 'null';
    // Use data attribute if set, otherwise use a hash of the element reference
    if (element.dataset && element.dataset.tgQueueId) {
      return element.dataset.tgQueueId;
    }
    // Generate and store ID
    const id = this.generateId();
    if (element.dataset) {
      element.dataset.tgQueueId = id;
    }
    return id;
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TranslationQueue;