/**
 * HistoryStorage - IndexedDB storage for translation history
 *
 * Provides persistent storage for translation history with support for
 * pagination, search, and efficient querying.
 */

const DB_NAME = 'TranslateGemmaHistory';
const DB_VERSION = 1;
const STORE_NAME = 'translations';
const META_STORE = 'metadata';

/**
 * HistoryStorage class for managing translation history
 */
export class HistoryStorage {
  /**
   * Create a new HistoryStorage instance
   */
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize the IndexedDB connection
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('HistoryStorage initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Main translations store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('originalText', 'originalText', { unique: false });
        }

        // Metadata store for rotation tracking
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, {
            keyPath: 'key'
          });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Add a new entry to the history
   * @param {Object} entry - The entry to add
   * @param {string} entry.originalText - Original text (truncated to 10000 chars)
   * @param {string} entry.translatedText - Translated text (truncated to 10000 chars)
   * @param {string} entry.url - URL of the page (truncated to 2048 chars)
   * @param {number} entry.timestamp - Unix timestamp
   * @param {string} entry.language - Language code (default: 'auto')
   * @param {number} entry.charCount - Character count
   * @param {number} entry.duration - Translation duration in ms
   * @returns {Promise<number>} - The ID of the added entry
   */
  async addEntry(entry) {
    await this.init();

    const dbEntry = {
      originalText: entry.originalText.substring(0, 10000),
      translatedText: entry.translatedText.substring(0, 10000),
      url: entry.url.substring(0, 2048),
      timestamp: entry.timestamp || Date.now(),
      language: entry.language || 'auto',
      charCount: entry.charCount || entry.originalText.length,
      duration: entry.duration || 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.add(dbEntry);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to add history entry:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get entries with pagination, filtering, and search
   * @param {Object} options - Query options
   * @param {number} options.limit - Max entries to return (default: 50)
   * @param {number} options.offset - Number of entries to skip (default: 0)
   * @param {string} options.search - Search string to filter entries
   * @param {number} options.startTime - Start timestamp for filtering
   * @param {number} options.endTime - End timestamp for filtering
   * @param {string} options.order - Sort order: 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>} - Array of history entries
   */
  async getEntries(options = {}) {
    await this.init();

    const {
      limit = 50,
      offset = 0,
      search = null,
      startTime = null,
      endTime = null,
      order = 'desc' // 'asc' or 'desc'
    } = options;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      const results = [];
      let skipped = 0;
      let counted = 0;

      const cursorDirection = order === 'desc' ? 'prev' : 'next';
      const request = index.openCursor(null, cursorDirection);

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor) {
          resolve(results);
          return;
        }

        const entry = cursor.value;

        // Apply time filters
        if (startTime && entry.timestamp < startTime) {
          if (order === 'desc') {
            // In desc order, we've passed all valid entries
            resolve(results);
            return;
          }
          cursor.continue();
          return;
        }

        if (endTime && entry.timestamp > endTime) {
          if (order === 'asc') {
            resolve(results);
            return;
          }
          cursor.continue();
          return;
        }

        // Apply search filter
        if (search && !this.matchesSearch(entry, search)) {
          cursor.continue();
          return;
        }

        // Apply offset
        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        // Add to results
        if (counted < limit) {
          results.push(entry);
          counted++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Check if an entry matches a search query
   * @param {Object} entry - History entry
   * @param {string} search - Search query
   * @returns {boolean} - True if entry matches
   */
  matchesSearch(entry, search) {
    const lowerSearch = search.toLowerCase();
    return (
      entry.originalText.toLowerCase().includes(lowerSearch) ||
      entry.translatedText.toLowerCase().includes(lowerSearch) ||
      entry.url.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * Get the total count of entries
   * @returns {Promise<number>}
   */
  async getCount() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a specific entry by ID
   * @param {number} id - Entry ID
   * @returns {Promise<void>}
   */
  async deleteEntry(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all entries from storage
   * @returns {Promise<void>}
   */
  async clearAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export default HistoryStorage;
