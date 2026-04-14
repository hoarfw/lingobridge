/**
 * ShadowRenderer - Creates shadow DOM containers for translations
 *
 * Provides isolated rendering environments that bypass CSP restrictions
 * and prevent style leakage between the translation UI and host page.
 */

/**
 * Default CSS styles for translation containers
 */
const DEFAULT_STYLES = `
  :host {
    display: block;
    margin: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    all: initial;
  }

  * {
    box-sizing: border-box;
  }

  .tg-translation-container {
    width: 100%;
  }

  .tg-translation-box {
    background: #f8f9fa;
    border-left: 4px solid #28a745;
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

  .tg-translation-icon {
    width: 14px;
    height: 14px;
    margin-right: 4px;
    vertical-align: middle;
  }

  .tg-translation-text {
    font-size: 14px;
    line-height: 1.6;
    color: #212529;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-style: italic;
  }

  .tg-translation-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #dee2e6;
  }

  .tg-action-btn {
    background: #fff;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 12px;
    color: #495057;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tg-action-btn:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
  }

  .tg-hide-btn {
    margin-left: auto;
  }

  @media (prefers-color-scheme: dark) {
    .tg-translation-box {
      background: #2d333b;
      border-left-color: #3fb950;
    }

    .tg-translation-label {
      color: #adbac7;
    }

    .tg-translation-text {
      color: #cdd9e5;
    }

    .tg-translation-actions {
      border-top-color: #444c56;
    }

    .tg-action-btn {
      background: #22272e;
      border-color: #444c56;
      color: #adbac7;
    }

    .tg-action-btn:hover {
      background: #2d333b;
      border-color: #539bf5;
    }
  }
`;

/**
 * ShadowRenderer class for creating isolated translation containers
 */
export class ShadowRenderer {
  /**
   * Create a shadow DOM host element
   * @param {Element} originalElement - The element to insert translation after
   * @returns {Object} - Object with host, shadowRoot, and hostId
   */
  static createHost(originalElement) {
    if (!originalElement || !originalElement.parentNode) {
      console.warn('ShadowRenderer: Invalid element provided');
      return null;
    }

    // Create unique ID
    const hostId = `tg-host-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the host element
    const host = document.createElement('div');
    host.id = hostId;
    host.className = 'tg-translation-host';
    host.setAttribute('data-tg-host', 'true');

    // Create shadow root with open mode for better debugging
    const shadowRoot = host.attachShadow({ mode: 'open' });

    // Insert the host after the specified element
    originalElement.parentNode.insertBefore(host, originalElement.nextSibling);

    return {
      host,
      shadowRoot,
      hostId
    };
  }

  /**
   * Remove a shadow DOM host element
   * @param {string|Element} hostOrId - The host element or its ID
   * @returns {boolean} - True if removal was successful
   */
  static removeHost(hostOrId) {
    let host;

    if (typeof hostOrId === 'string') {
      host = document.getElementById(hostOrId);
    } else if (hostOrId instanceof Element) {
      host = hostOrId;
    }

    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
      return true;
    }

    return false;
  }

  /**
   * Apply default styles to a shadow root
   * @param {ShadowRoot} shadowRoot - The shadow root to style
   * @param {string} customStyles - Optional custom CSS to include
   */
  static applyStyles(shadowRoot, customStyles = '') {
    if (!shadowRoot) {
      console.warn('ShadowRenderer: No shadow root provided');
      return;
    }

    const style = document.createElement('style');
    style.textContent = DEFAULT_STYLES + customStyles;
    shadowRoot.appendChild(style);
  }

  /**
   * Create a translation container in the shadow DOM
   * @param {ShadowRoot} shadowRoot - The shadow root
   * @param {string} className - CSS class for the container
   * @returns {Element} - The created container
   */
  static createContainer(shadowRoot, className = 'tg-translation-container') {
    if (!shadowRoot) {
      console.warn('ShadowRenderer: No shadow root provided');
      return null;
    }

    const container = document.createElement('div');
    container.className = className;
    shadowRoot.appendChild(container);
    return container;
  }

  /**
   * Create a full translation display in shadow DOM
   * @param {Element} originalElement - The element to insert translation after
   * @param {string} translationText - The translated text to display
   * @param {Object} options - Optional configuration
   * @returns {Object} - Object with host, container, and controls
   */
  static renderTranslation(originalElement, translationText, options = {}) {
    if (!originalElement || !translationText) {
      console.warn('ShadowRenderer: Missing required parameters');
      return null;
    }

    // Create shadow host
    const { host, shadowRoot, hostId } = this.createHost(originalElement);

    if (!shadowRoot) {
      console.error('ShadowRenderer: Failed to create shadow DOM');
      return null;
    }

    // Apply styles
    this.applyStyles(shadowRoot, options.customStyles || '');

    // Create container
    const container = this.createContainer(shadowRoot, 'tg-translation-box');

    // Build the translation content
    container.innerHTML = `
      <div class="tg-translation-header">
        <span class="tg-translation-label">🌐 Translation</span>
      </div>
      <div class="tg-translation-text">${this.escapeHtml(translationText)}</div>
      <div class="tg-translation-actions">
        <button class="tg-action-btn tg-copy-btn" title="Copy translation">📋 Copy</button>
        <button class="tg-action-btn tg-hide-btn tg-close-btn" title="Hide translation">✕ Hide</button>
      </div>
    `;

    // Add event listeners
    const copyBtn = container.querySelector('.tg-copy-btn');
    const closeBtn = container.querySelector('.tg-close-btn');

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(translationText);
          copyBtn.textContent = '✓ Copied';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.removeHost(host);
      });
    }

    // Mark original element as translated
    originalElement.setAttribute('data-tg-translated', 'true');
    originalElement.setAttribute('data-tg-host-id', hostId);

    return {
      host,
      shadowRoot,
      container,
      hostId,
      controls: {
        copyBtn,
        closeBtn
      }
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
   * Get the default CSS styles
   * @returns {string} - CSS styles
   */
  static getDefaultStyles() {
    return DEFAULT_STYLES;
  }
}

export default ShadowRenderer;
