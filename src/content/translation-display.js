import { ShadowDOMManager } from './shadow-dom-manager.js';

/**
 * TranslationDisplay - Renders translation results in shadow DOM
 */
export class TranslationDisplay {
  /**
   * Render a translation in the shadow DOM
   * @param {string} translation - The translated text
   * @param {Element} targetElement - The element to insert translation after
   * @returns {Object} - Object with host and container references
   */
  static render(translation, targetElement) {
    if (!translation || !targetElement) {
      console.warn('TranslationDisplay: Missing translation or target element');
      return null;
    }

    // Escape the translation text to prevent XSS
    const escapedTranslation = this.escapeHtml(translation);

    // Create shadow DOM host
    const { host, shadowRoot } = ShadowDOMManager.createHost(targetElement);

    if (!shadowRoot) {
      console.error('TranslationDisplay: Failed to create shadow DOM');
      return null;
    }

    // Inject styles
    ShadowDOMManager.injectStyles(shadowRoot, this.getStyles());

    // Create container
    const container = ShadowDOMManager.createContainer(shadowRoot, 'tg-translation-container');

    // Build the translation box
    container.innerHTML = `
      <div class="tg-translation-box">
        <div class="tg-translation-header">
          <span class="tg-translation-label">Translated by LingoBridge 灵桥翻译</span>
          <button class="tg-close-btn" aria-label="Close translation">×</button>
        </div>
        <div class="tg-translation-text">${escapedTranslation}</div>
      </div>
    `;

    // Add close button functionality
    const closeBtn = container.querySelector('.tg-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        ShadowDOMManager.removeHost(host);
      });
    }

    return {
      host,
      shadowRoot,
      container,
      translationId: host.id
    };
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  static escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS styles for the translation display
   * @returns {string} - CSS string
   */
  static getStyles() {
    return `
      :host {
        display: block;
        margin: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }

      .tg-translation-container {
        width: 100%;
      }

      .tg-translation-box {
        background: #f8f9fa;
        border-left: 4px solid #4a90d9;
        border-radius: 4px;
        padding: 12px 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .tg-translation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .tg-translation-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6c757d;
      }

      .tg-close-btn {
        background: none;
        border: none;
        font-size: 20px;
        line-height: 1;
        color: #6c757d;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s, color 0.2s;
      }

      .tg-close-btn:hover {
        background-color: #e9ecef;
        color: #495057;
      }

      .tg-translation-text {
        font-size: 14px;
        line-height: 1.6;
        color: #212529;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      @media (prefers-color-scheme: dark) {
        .tg-translation-box {
          background: #2d333b;
          border-left-color: #539bf5;
        }

        .tg-translation-label {
          color: #adbac7;
        }

        .tg-translation-text {
          color: #cdd9e5;
        }

        .tg-close-btn {
          color: #adbac7;
        }

        .tg-close-btn:hover {
          background-color: #444c56;
          color: #cdd9e5;
        }
      }
    `;
  }
}
