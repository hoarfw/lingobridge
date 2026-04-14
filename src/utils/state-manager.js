/**
 * StateManager - Wrapper around chrome.storage.local for service worker state persistence
 * Ensures MV3 compliance by never storing state in memory
 */
export const StateManager = {
  /**
   * Get one or more values from storage
   * @param {string|string[]|Object} keys - Key(s) to retrieve, or object with default values
   * @returns {Promise<Object>} - Object with retrieved values
   */
  async get(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Set one or more values in storage
   * @param {Object} items - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  async set(items) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Remove one or more keys from storage
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Clear all data from storage (use with caution)
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
};
