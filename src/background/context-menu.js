/**
 * ContextMenuManager - Manages the right-click context menu for translation
 */
export class ContextMenuManager {
  static MENU_ID = 'translate-selection';

  /**
   * Register the context menu
   */
  static register() {
    // Remove any existing menu items to avoid duplicates
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create(
        {
          id: this.MENU_ID,
          title: 'Translate with LingoBridge',
          contexts: ['selection']
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error('Context menu creation failed:', chrome.runtime.lastError);
          } else {
            console.log('Context menu registered successfully');
          }
        }
      );
    });
  }

  /**
   * Handle context menu click
   * @param {Object} info - Context menu click info
   * @param {Object} tab - Current tab
   */
  static async handleClick(info, tab) {
    if (info.menuItemId !== this.MENU_ID) {
      return;
    }

    if (!info.selectionText || !tab?.id) {
      console.warn('Context menu click: missing selection or tab');
      return;
    }

    try {
      // Send message to content script to trigger translation
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_TRANSLATION',
        text: info.selectionText
      });
    } catch (error) {
      console.error('Failed to trigger translation from context menu:', error);
    }
  }

  /**
   * Unregister the context menu
   */
  static unregister() {
    chrome.contextMenus.removeAll(() => {
      console.log('Context menu unregistered');
    });
  }
}

// Export a convenience function for registration
export function registerContextMenu() {
  // Register on install
  chrome.runtime.onInstalled.addListener(() => {
    ContextMenuManager.register();
  });

  // Also register immediately in case of service worker restart
  ContextMenuManager.register();

  // Handle clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    ContextMenuManager.handleClick(info, tab);
  });

  console.log('Context menu handlers registered');
}
