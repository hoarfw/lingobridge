import { ShadowDOMManager } from './shadow-dom-manager.js';
import { getUserMessage } from '../utils/user-messages.js';
import { categorizeError } from '../utils/error-categories.js';

/**
 * ErrorDisplay - Renders error messages in shadow DOM with styled error box
 */
export class ErrorDisplay {
  static instances = new Map();

  /**
   * Display an error message
   * @param {Error} error - The error object
   * @param {Element} targetElement - The element to insert error display after
   * @returns {string} - The ID of the error display instance
   */
  static display(error, targetElement) {
    if (!targetElement) {
      console.warn('ErrorDisplay: No target element provided');
      return null;
    }

    // Get error category and user-friendly message
    const errorCategory = categorizeError(error);
    const userMessage = getUserMessage(errorCategory, { model: error.model });

    // Create shadow DOM host
    const { host, shadowRoot } = ShadowDOMManager.createHost(targetElement);

    if (!shadowRoot) {
      console.error('ErrorDisplay: Failed to create shadow DOM');
      return null;
    }

    // Inject styles
    ShadowDOMManager.injectStyles(shadowRoot, this.getStyles());

    // Create container
    const container = ShadowDOMManager.createContainer(shadowRoot, 'tg-error-container');

    // Build the error box
    container.innerHTML = `
      <div class="tg-error-box">
        <div class="tg-error-header">
          <div class="tg-error-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="currentColor"/>
            </svg>
          </div>
          <span class="tg-error-title">${userMessage.title}</span>
          <button class="tg-close-btn" aria-label="Close error">×</button>
        </div>
        <div class="tg-error-content">
          <p class="tg-error-message">${userMessage.message}</p>
          ${userMessage.action ? `<p class="tg-error-action"><strong>Action:</strong> ${userMessage.action}</p>` : ''}
        </div>
      </div>
    `;

    // Add close button functionality
    const closeBtn = container.querySelector('.tg-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.remove(host.id);
      });
    }

    // Auto-remove after 30 seconds
    const autoRemoveTimeout = setTimeout(() => {
      this.remove(host.id);
    }, 30000);

    // Store instance
    this.instances.set(host.id, {
      host,
      shadowRoot,
      container,
      autoRemoveTimeout
    });

    return host.id;
  }

  /**
   * Remove an error display by ID
   * @param {string} errorId - The ID of the error display to remove
   */
  static remove(errorId) {
    if (!errorId) {
      return;
    }

    const instance = this.instances.get(errorId);
    if (instance) {
      // Clear auto-remove timeout
      if (instance.autoRemoveTimeout) {
        clearTimeout(instance.autoRemoveTimeout);
      }

      // Remove from DOM
      ShadowDOMManager.removeHost(instance.host);

      // Remove from instances map
      this.instances.delete(errorId);
    }
  }

  /**
   * Remove all error displays
   */
  static removeAll() {
    for (const [id, instance] of this.instances) {
      if (instance.autoRemoveTimeout) {
        clearTimeout(instance.autoRemoveTimeout);
      }
      ShadowDOMManager.removeHost(instance.host);
    }
    this.instances.clear();
  }

  /**
   * Get CSS styles for the error display
   * @returns {string} - CSS string
   */
  static getStyles() {
    return `
      :host {
        display: block;
        margin: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }

      .tg-error-container {
        width: 100%;
      }

      .tg-error-box {
        background: #fff5f5;
        border-left: 4px solid #e53e3e;
        border-radius: 4px;
        padding: 12px 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .tg-error-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .tg-error-icon {
        color: #e53e3e;
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }

      .tg-error-title {
        font-weight: 600;
        font-size: 14px;
        color: #c53030;
        flex: 1;
      }

      .tg-close-btn {
        background: none;
        border: none;
        font-size: 20px;
        line-height: 1;
        color: #9b2c2c;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s, color 0.2s;
        flex-shrink: 0;
      }

      .tg-close-btn:hover {
        background-color: #fed7d7;
        color: #742a2a;
      }

      .tg-error-content {
        padding-left: 28px;
      }

      .tg-error-message {
        font-size: 13px;
        color: #c53030;
        margin: 0 0 4px 0;
        line-height: 1.5;
      }

      .tg-error-action {
        font-size: 12px;
        color: #9b2c2c;
        margin: 0;
        font-style: italic;
      }

      .tg-error-action strong {
        font-weight: 600;
        color: #c53030;
        font-style: normal;
      }

      @media (prefers-color-scheme: dark) {
        .tg-error-box {
          background: #2d1f1f;
          border-left-color: #e53e3e;
        }

        .tg-error-icon {
          color: #e53e3e;
        }

        .tg-error-title {
          color: #feb2b2;
        }

        .tg-close-btn {
          color: #feb2b2;
        }

        .tg-close-btn:hover {
          background-color: #4a2c2c;
          color: #fed7d7;
        }

        .tg-error-message {
          color: #feb2b2;
        }

        .tg-error-action {
          color: #fc8181;
        }

        .tg-error-action strong {
          color: #feb2b2;
        }
      }
    `;
  }
}
