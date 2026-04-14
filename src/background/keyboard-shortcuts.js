/**
 * KeyboardShortcutsManager - Manages keyboard shortcuts for translation
 */
export class KeyboardShortcutsManager {
  /**
   * Register keyboard shortcuts handler
   */
  static register() {
    chrome.commands.onCommand.addListener(async (command, tab) => {
      if (command === 'translate-selection') {
        await this.handleTranslateSelection(tab);
      }
    });

    console.log('Keyboard shortcuts registered');
  }

  /**
   * Handle translate selection command
   * @param {Object} tab - Current tab
   */
  static async handleTranslateSelection(tab) {
    if (!tab?.id) {
      console.warn('Keyboard shortcut: no active tab');
      return;
    }

    try {
      // Get selected text from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTED_TEXT'
      });

      if (!response?.text) {
        console.log('Keyboard shortcut: no text selected');
        return;
      }

      // Trigger translation
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_TRANSLATION',
        text: response.text,
        elementInfo: response.elementInfo
      });
    } catch (error) {
      // Content script might not be injected yet, inject it
      if (error.message?.includes('Receiving end does not exist')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content.js']
          });

          // Retry after injection
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'GET_SELECTED_TEXT'
          });

          if (response?.text) {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'TRIGGER_TRANSLATION',
              text: response.text
            });
          }
        } catch (retryError) {
          console.error('Failed to inject content script:', retryError);
        }
      } else {
        console.error('Keyboard shortcut error:', error);
      }
    }
  }

  /**
   * Unregister keyboard shortcuts (mainly for testing)
   */
  static unregister() {
    // Note: Chrome doesn't provide a way to remove specific command listeners
    // This is mainly a placeholder for consistency
    console.log('Keyboard shortcuts cannot be fully unregistered in Chrome');
  }
}

// Export a convenience function for registration
export function registerKeyboardShortcuts() {
  KeyboardShortcutsManager.register();
}
