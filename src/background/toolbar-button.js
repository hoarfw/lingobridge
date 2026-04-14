/**
 * ToolbarButtonManager - Manages the toolbar button (action) click handler
 */
export class ToolbarButtonManager {
  /**
   * Register the toolbar button click handler
   */
  static register() {
    chrome.action.onClicked.addListener(async (tab) => {
      await this.handleClick(tab);
    });

    console.log('Toolbar button registered');
  }

  /**
   * Handle toolbar button click
   * @param {Object} tab - Current tab
   */
  static async handleClick(tab) {
    if (!tab?.id) {
      console.warn('Toolbar button: no active tab');
      return;
    }

    try {
      // Get selected text from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTED_TEXT'
      });

      if (!response?.text) {
        // Show a notification that no text is selected
        await this.showNotification('No text selected', 'Please select some text to translate.');
        return;
      }

      // Trigger translation
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRIGGER_TRANSLATION',
        text: response.text,
        elementInfo: response.elementInfo
      });
    } catch (error) {
      // Content script might not be injected yet, try to inject it
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
          } else {
            await this.showNotification('No text selected', 'Please select some text to translate.');
          }
        } catch (retryError) {
          console.error('Failed to inject content script:', retryError);
          await this.showNotification('Error', 'Could not initialize translation. Please refresh the page.');
        }
      } else {
        console.error('Toolbar button error:', error);
      }
    }
  }

  /**
   * Show a notification to the user
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   */
  static async showNotification(title, message) {
    try {
      // Try to use Chrome notifications API
      if (chrome.notifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title,
          message
        });
      }
    } catch (error) {
      console.warn('Could not show notification:', error);
      // Notifications are optional, don't fail if they're not available
    }
  }

  /**
   * Unregister the toolbar button (mainly for testing)
   */
  static unregister() {
    // Note: Chrome doesn't provide a way to remove specific action listeners
    // This is mainly a placeholder for consistency
    console.log('Toolbar button cannot be fully unregistered in Chrome');
  }
}

// Export a convenience function for registration
export function registerToolbarButton() {
  ToolbarButtonManager.register();
}
