import { ShadowDOMManager } from './shadow-dom-manager.js';

/**
 * ProgressIndicator - Shows a spinner and "Translating..." text during translation
 */
export class ProgressIndicator {
  static instances = new Map();

  /**
   * Show the progress indicator
   * @param {Element} targetElement - The element to insert progress indicator after
   * @returns {string} - The ID of the progress indicator instance
   */
  static show(targetElement) {
    if (!targetElement) {
      console.warn('ProgressIndicator: No target element provided');
      return null;
    }

    // Create shadow DOM host
    const { host, shadowRoot } = ShadowDOMManager.createHost(targetElement);

    if (!shadowRoot) {
      console.error('ProgressIndicator: Failed to create shadow DOM');
      return null;
    }

    // Inject styles
    ShadowDOMManager.injectStyles(shadowRoot, this.getStyles());

    // Create container
    const container = ShadowDOMManager.createContainer(shadowRoot, 'tg-progress-container');

    // Build the progress indicator
    container.innerHTML = `
      <div class="tg-progress-box">
        <div class="tg-spinner"></div>
        <span class="tg-progress-text">Translating...</span>
      </div>
    `;

    // Store instance
    this.instances.set(host.id, { host, shadowRoot, container });

    return host.id;
  }

  /**
   * Hide the progress indicator
   * @param {string} progressId - The ID of the progress indicator to hide
   */
  static hide(progressId) {
    if (!progressId) {
      return;
    }

    const instance = this.instances.get(progressId);
    if (instance) {
      ShadowDOMManager.removeHost(instance.host);
      this.instances.delete(progressId);
    }
  }

  /**
   * Hide all active progress indicators
   */
  static hideAll() {
    for (const [id, instance] of this.instances) {
      ShadowDOMManager.removeHost(instance.host);
    }
    this.instances.clear();
  }

  /**
   * Get CSS styles for the progress indicator
   * @returns {string} - CSS string
   */
  static getStyles() {
    return `
      :host {
        display: block;
        margin: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      }

      .tg-progress-container {
        width: 100%;
      }

      .tg-progress-box {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: #f8f9fa;
        border-left: 4px solid #4a90d9;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .tg-spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #e9ecef;
        border-top-color: #4a90d9;
        border-radius: 50%;
        animation: tg-spin 1s linear infinite;
        flex-shrink: 0;
      }

      @keyframes tg-spin {
        to {
          transform: rotate(360deg);
        }
      }

      .tg-progress-text {
        font-size: 14px;
        color: #495057;
        font-weight: 500;
      }

      @media (prefers-color-scheme: dark) {
        .tg-progress-box {
          background: #2d333b;
          border-left-color: #539bf5;
        }

        .tg-spinner {
          border-color: #444c56;
          border-top-color: #539bf5;
        }

        .tg-progress-text {
          color: #adbac7;
        }
      }
    `;
  }
}
