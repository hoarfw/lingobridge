/**
 * SPAHandler - Manages dynamic content translation for Single Page Applications
 *
 * This class handles:
 * - Detecting new content via MutationObserver
 * - Showing user notifications for new paragraphs
 * - Auto-translating when enabled
 * - Managing the lifecycle of dynamic content translation
 */

import TranslationMutationObserver from './mutation-observer.js';

class SPAHandler {
  constructor(pageTranslator, options = {}) {
    if (!pageTranslator) {
      throw new Error('SPAHandler requires a pageTranslator instance');
    }

    this.pageTranslator = pageTranslator;
    this.mutationObserver = null;
    this.autoTranslate = options.autoTranslate || false;
    this.showNotification = options.showNotification || this.defaultNotification.bind(this);

    this.pendingParagraphs = [];
    this.isNotificationVisible = false;
    this.notificationElement = null;
    this.stylesElement = null;
    this.autoDismissTimer = null;

    // Bind methods to preserve 'this' context
    this.handleNewParagraphs = this.handleNewParagraphs.bind(this);
    this.handleObserverError = this.handleObserverError.bind(this);
    this.translatePendingParagraphs = this.translatePendingParagraphs.bind(this);
    this.dismissNotification = this.dismissNotification.bind(this);
    this.clearPendingParagraphs = this.clearPendingParagraphs.bind(this);
  }

  /**
   * Initialize the SPA handler and start observing mutations
   */
  initialize() {
    if (this.mutationObserver) {
      console.warn('[SPAHandler] Already initialized');
      return;
    }

    try {
      this.mutationObserver = new TranslationMutationObserver({
        onNewParagraphs: this.handleNewParagraphs,
        onError: this.handleObserverError,
        debounceMs: 500
      });

      this.mutationObserver.start();
      console.log('[SPAHandler] Initialized and observing');
    } catch (error) {
      console.error('[SPAHandler] Failed to initialize:', error);
      this.handleObserverError({ type: 'INIT_ERROR', error });
    }
  }

  /**
   * Handle new paragraphs detected by the mutation observer
   * @param {Object} data - Data about new paragraphs
   * @param {Element[]} data.paragraphs - Array of new paragraph elements
   * @param {number} data.count - Number of paragraphs
   * @param {number} data.timestamp - Detection timestamp
   */
  handleNewParagraphs({ paragraphs, count }) {
    console.log(`[SPAHandler] Detected ${count} new paragraph(s)`);

    if (this.autoTranslate) {
      // Automatically translate new content
      this.pageTranslator.translateNewParagraphs(paragraphs);
    } else {
      // Show notification to user
      this.pendingParagraphs.push(...paragraphs);
      this.showTranslationNotification(count);
    }
  }

  /**
   * Show a notification to the user about new content
   * @param {number} count - Number of new paragraphs
   */
  showTranslationNotification(count) {
    if (this.isNotificationVisible) {
      // Update existing notification
      this.updateNotification(count);
      return;
    }

    this.isNotificationVisible = true;

    // Create notification element
    this.notificationElement = document.createElement('div');
    this.notificationElement.id = 'tg-spa-notification';
    this.notificationElement.innerHTML = `
      <div class="tg-notification-content">
        <span class="tg-notification-text">
          ${count} new paragraph${count !== 1 ? 's' : ''} detected
        </span>
        <div class="tg-notification-actions">
          <button class="tg-btn tg-btn-primary" id="tg-translate-new">Translate</button>
          <button class="tg-btn tg-btn-secondary" id="tg-ignore-new">Ignore</button>
        </div>
      </div>
    `;

    // Add styles
    this.stylesElement = document.createElement('style');
    this.stylesElement.textContent = this.getNotificationStyles();

    document.head.appendChild(this.stylesElement);
    document.body.appendChild(this.notificationElement);

    // Add event listeners
    this.notificationElement.querySelector('#tg-translate-new').addEventListener('click', this.translatePendingParagraphs);
    this.notificationElement.querySelector('#tg-ignore-new').addEventListener('click', this.clearPendingParagraphs);

    // Auto-dismiss after 30 seconds
    this.autoDismissTimer = setTimeout(() => {
      if (this.isNotificationVisible) {
        this.dismissNotification();
      }
    }, 30000);

    console.log('[SPAHandler] Notification shown');
  }

  /**
   * Get CSS styles for the notification
   * @returns {string} CSS styles
   */
  getNotificationStyles() {
    return `
      #tg-spa-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        max-width: 300px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, -apple-system-body, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      #tg-spa-notification .tg-notification-text {
        display: block;
        margin-bottom: 12px;
        color: #333;
      }
      #tg-spa-notification .tg-notification-actions {
        display: flex;
        gap: 8px;
      }
      #tg-spa-notification .tg-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s, transform 0.1s;
      }
      #tg-spa-notification .tg-btn:hover {
        transform: translateY(-1px);
      }
      #tg-spa-notification .tg-btn:active {
        transform: translateY(0);
      }
      #tg-spa-notification .tg-btn-primary {
        background: #4CAF50;
        color: white;
      }
      #tg-spa-notification .tg-btn-primary:hover {
        background: #45a049;
      }
      #tg-spa-notification .tg-btn-secondary {
        background: #f0f0f0;
        color: #333;
      }
      #tg-spa-notification .tg-btn-secondary:hover {
        background: #e0e0e0;
      }
      @media (prefers-color-scheme: dark) {
        #tg-spa-notification {
          background: #2d2d2d;
          border-color: #444;
          color: #fff;
        }
        #tg-spa-notification .tg-notification-text {
          color: #fff;
        }
        #tg-spa-notification .tg-btn-secondary {
          background: #444;
          color: #fff;
        }
      }
    `;
  }

  /**
   * Dismiss the notification
   */
  dismissNotification() {
    if (this.notificationElement) {
      this.notificationElement.remove();
      this.notificationElement = null;
    }

    if (this.stylesElement) {
      this.stylesElement.remove();
      this.stylesElement = null;
    }

    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    this.isNotificationVisible = false;
    console.log('[SPAHandler] Notification dismissed');
  }

  /**
   * Update the notification with new count
   * @param {number} count - Updated count of new paragraphs
   */
  updateNotification(count) {
    const text = this.notificationElement?.querySelector('.tg-notification-text');
    if (text) {
      text.textContent = `${count} new paragraph${count !== 1 ? 's' : ''} detected`;
    }
  }

  /**
   * Translate the pending paragraphs
   */
  translatePendingParagraphs() {
    console.log(`[SPAHandler] Translating ${this.pendingParagraphs.length} pending paragraph(s)`);

    if (this.pendingParagraphs.length > 0) {
      this.pageTranslator.translateNewParagraphs(this.pendingParagraphs);
      this.pendingParagraphs = [];
    }

    this.dismissNotification();
  }

  /**
   * Clear pending paragraphs without translating
   */
  clearPendingParagraphs() {
    console.log(`[SPAHandler] Clearing ${this.pendingParagraphs.length} pending paragraph(s)`);

    // Mark paragraphs as ignored
    this.pendingParagraphs.forEach(p => {
      if (p && p.setAttribute) {
        p.setAttribute('data-tg-ignored', 'true');
      }
    });

    this.pendingParagraphs = [];
    this.dismissNotification();
  }

  /**
   * Handle observer errors
   * @param {Object} error - Error object
   */
  handleObserverError({ type, error }) {
    console.error('[SPAHandler] Observer error:', type, error);
  }

  /**
   * Default notification handler
   * @param {string} message - Notification message
   */
  defaultNotification(message) {
    console.log('[SPAHandler] Notification:', message);
  }

  /**
   * Set auto-translate mode
   * @param {boolean} enabled - Whether to enable auto-translate
   */
  setAutoTranslate(enabled) {
    console.log(`[SPAHandler] Auto-translate ${enabled ? 'enabled' : 'disabled'}`);
    this.autoTranslate = enabled;
  }

  /**
   * Get auto-translate status
   * @returns {boolean} Current auto-translate status
   */
  isAutoTranslateEnabled() {
    return this.autoTranslate;
  }

  /**
   * Get pending paragraphs count
   * @returns {number} Number of pending paragraphs
   */
  getPendingCount() {
    return this.pendingParagraphs.length;
  }

  /**
   * Destroy the handler and cleanup
   */
  destroy() {
    console.log('[SPAHandler] Destroying');

    if (this.mutationObserver) {
      this.mutationObserver.stop();
      this.mutationObserver = null;
    }

    this.dismissNotification();
    this.pendingParagraphs = [];
  }
}

export default SPAHandler;
