/**
 * ShadowDOMManager - Manages creation and lifecycle of shadow DOM containers
 * Used to isolate translation UI from page CSS and bypass CSP restrictions
 */
export class ShadowDOMManager {
  /**
   * Create a shadow DOM host element
   * @param {Element} afterElement - The element to insert the shadow host after
   * @returns {Object} - Object with host element and shadow root
   */
  static createHost(afterElement) {
    if (!afterElement || !afterElement.parentNode) {
      console.warn('ShadowDOMManager: Invalid element provided');
      return null;
    }

    // Create unique ID
    const hostId = `tg-host-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the host element
    const host = document.createElement('div');
    host.id = hostId;
    host.className = 'translate-gemma-host';
    host.setAttribute('data-tg-host', 'true');

    // Create shadow root with closed mode for maximum isolation
    const shadowRoot = host.attachShadow({ mode: 'closed' });

    // Insert after the target element for normal page elements.
    // If the fallback target is <body>, append inside body so the UI stays visible.
    if (afterElement === document.body) {
      document.body.appendChild(host);
    } else {
      afterElement.parentNode.insertBefore(host, afterElement.nextSibling);
    }

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
   * Inject styles into a shadow root
   * @param {ShadowRoot} shadowRoot - The shadow root to inject styles into
   * @param {string} css - The CSS string to inject
   */
  static injectStyles(shadowRoot, css) {
    if (!shadowRoot) {
      console.warn('ShadowDOMManager: No shadow root provided');
      return;
    }

    const style = document.createElement('style');
    style.textContent = css;
    shadowRoot.appendChild(style);
  }

  /**
   * Create a container element inside shadow DOM
   * @param {ShadowRoot} shadowRoot - The shadow root
   * @param {string} className - CSS class for the container
   * @returns {Element} - The created container
   */
  static createContainer(shadowRoot, className = 'tg-container') {
    if (!shadowRoot) {
      console.warn('ShadowDOMManager: No shadow root provided');
      return null;
    }

    const container = document.createElement('div');
    container.className = className;
    shadowRoot.appendChild(container);
    return container;
  }
}
