/**
 * @jest-environment jsdom
 */

import { HistoryStorage } from '../history-storage.js';

describe('HistoryStorage', () => {
  let storage;

  beforeEach(async () => {
    // Clear any existing database
    const deleteRequest = indexedDB.deleteDatabase('LingoBridgeHistory');
    await new Promise((resolve, reject) => {
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = resolve;
    });

    storage = new HistoryStorage();
    await storage.init();
  });

  afterEach(async () => {
    if (storage && storage.db) {
      storage.db.close();
    }
  });

  describe('initialization', () => {
    it('should initialize the database', () => {
      expect(storage.db).not.toBeNull();
      expect(storage.db.name).toBe('LingoBridgeHistory');
      expect(storage.db.version).toBe(1);
    });

    it('should create the required object stores', () => {
      const storeNames = Array.from(storage.db.objectStoreNames);
      expect(storeNames).toContain('translations');
      expect(storeNames).toContain('metadata');
    });

    it('should create indexes on the translations store', () => {
      const transaction = storage.db.transaction(['translations'], 'readonly');
      const store = transaction.objectStore('translations');
      const indexNames = Array.from(store.indexNames);

      expect(indexNames).toContain('timestamp');
      expect(indexNames).toContain('url');
      expect(indexNames).toContain('originalText');
    });
  });

  describe('addEntry', () => {
    it('should add an entry and return an ID', async () => {
      const entry = {
        originalText: 'Hello world',
        translatedText: 'Bonjour le monde',
        url: 'https://example.com',
        timestamp: Date.now(),
        language: 'fr',
        charCount: 11,
        duration: 500
      };

      const id = await storage.addEntry(entry);

      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should truncate long text fields', async () => {
      const longText = 'a'.repeat(15000);
      const entry = {
        originalText: longText,
        translatedText: longText,
        url: 'b'.repeat(3000),
        timestamp: Date.now()
      };

      await storage.addEntry(entry);
      const entries = await storage.getEntries({ limit: 1 });

      expect(entries[0].originalText.length).toBe(10000);
      expect(entries[0].translatedText.length).toBe(10000);
      expect(entries[0].url.length).toBe(2048);
    });

    it('should use defaults for optional fields', async () => {
      const entry = {
        originalText: 'Hello',
        translatedText: 'Bonjour',
        url: 'https://example.com'
      };

      await storage.addEntry(entry);
      const entries = await storage.getEntries({ limit: 1 });

      expect(entries[0].language).toBe('auto');
      expect(entries[0].charCount).toBe(5);
      expect(entries[0].duration).toBe(0);
      expect(typeof entries[0].timestamp).toBe('number');
    });
  });

  describe('getEntries', () => {
    beforeEach(async () => {
      // Add test entries
      for (let i = 0; i < 10; i++) {
        await storage.addEntry({
          originalText: `Original text ${i}`,
          translatedText: `Translated text ${i}`,
          url: `https://example.com/page${i}`,
          timestamp: Date.now() + i * 1000
        });
      }
    });

    it('should return entries with default limit', async () => {
      const entries = await storage.getEntries();
      expect(entries.length).toBeLessThanOrEqual(50);
    });

    it('should respect limit parameter', async () => {
      const entries = await storage.getEntries({ limit: 5 });
      expect(entries.length).toBe(5);
    });

    it('should respect offset parameter', async () => {
      const entries = await storage.getEntries({ limit: 5, offset: 5 });
      expect(entries.length).toBe(5);
    });

    it('should sort by timestamp in descending order by default', async () => {
      const entries = await storage.getEntries({ limit: 3 });
      expect(entries[0].timestamp).toBeGreaterThan(entries[1].timestamp);
      expect(entries[1].timestamp).toBeGreaterThan(entries[2].timestamp);
    });

    it('should sort in ascending order when specified', async () => {
      const entries = await storage.getEntries({ limit: 3, order: 'asc' });
      expect(entries[0].timestamp).toBeLessThan(entries[1].timestamp);
      expect(entries[1].timestamp).toBeLessThan(entries[2].timestamp);
    });

    it('should filter by search term', async () => {
      await storage.addEntry({
        originalText: 'Unique search term xyz',
        translatedText: 'Translated',
        url: 'https://example.com'
      });

      const entries = await storage.getEntries({ search: 'xyz' });
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].originalText).toContain('xyz');
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      await storage.addEntry({
        originalText: 'Time range test',
        translatedText: 'Translated',
        url: 'https://example.com',
        timestamp: now - 5000
      });

      const entries = await storage.getEntries({
        startTime: now - 10000,
        endTime: now
      });

      expect(entries.some(e => e.originalText === 'Time range test')).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return 0 for empty database', async () => {
      const count = await storage.getCount();
      expect(count).toBe(0);
    });

    it('should return correct count after adding entries', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      const count = await storage.getCount();
      expect(count).toBe(5);
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry by ID', async () => {
      const id = await storage.addEntry({
        originalText: 'To be deleted',
        translatedText: 'Translated',
        url: 'https://example.com'
      });

      await storage.deleteEntry(id);

      const entries = await storage.getEntries();
      expect(entries.some(e => e.id === id)).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all entries', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      await storage.clearAll();

      const count = await storage.getCount();
      expect(count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle quota exceeded errors gracefully', async () => {
      // Mock the add operation to simulate quota error
      const mockTransaction = {
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn().mockReturnValue({
            set onsuccess(cb) { setTimeout(() => cb({ target: { result: 1 } }), 0); },
            set onerror(cb) { setTimeout(() => cb({ target: { error: { name: 'QuotaExceededError' } } }), 0); }
          })
        })
      };

      storage.db = {
        transaction: jest.fn().mockReturnValue(mockTransaction)
      };

      const entry = {
        originalText: 'Test',
        translatedText: 'Translated',
        url: 'https://example.com'
      };

      await expect(storage.addEntry(entry)).rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      // Create new storage instance to test init failure
      const badStorage = new HistoryStorage();

      // Mock indexedDB.open to fail
      const originalOpen = indexedDB.open;
      indexedDB.open = jest.fn().mockReturnValue({
        set onerror(cb) { setTimeout(() => cb({ target: { error: new Error('Connection failed') } }), 0); }
      });

      await expect(badStorage.init()).rejects.toThrow('Connection failed');

      // Restore
      indexedDB.open = originalOpen;
    });
  });
});

export default HistoryStorage;
