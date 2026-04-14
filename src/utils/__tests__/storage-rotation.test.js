/**
 * @jest-environment jsdom
 */

import { StorageRotation } from '../storage-rotation.js';
import { HistoryStorage } from '../../services/history-storage.js';

// Mock console methods to reduce noise
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('StorageRotation', () => {
  let storage;
  let rotation;

  beforeEach(async () => {
    // Clear any existing database
    const deleteRequest = indexedDB.deleteDatabase('TranslateGemmaHistory');
    await new Promise((resolve, reject) => {
      deleteRequest.onsuccess = resolve;
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = resolve;
    });

    storage = new HistoryStorage();
    await storage.init();

    rotation = new StorageRotation(storage, {
      maxEntries: 100,
      rotationTrigger: 0.9,
      entriesToDelete: 10
    });
  });

  afterEach(async () => {
    if (storage && storage.db) {
      storage.db.close();
    }
  });

  describe('constructor', () => {
    it('should use default options when not provided', () => {
      const defaultRotation = new StorageRotation(storage);

      expect(defaultRotation.maxEntries).toBe(500);
      expect(defaultRotation.rotationTrigger).toBe(0.9);
      expect(defaultRotation.entriesToDelete).toBe(50);
    });

    it('should use custom options when provided', () => {
      expect(rotation.maxEntries).toBe(100);
      expect(rotation.rotationTrigger).toBe(0.9);
      expect(rotation.entriesToDelete).toBe(10);
    });
  });

  describe('checkAndRotate', () => {
    it('should not rotate when under threshold', async () => {
      // Add 80 entries (under 90% of 100)
      for (let i = 0; i < 80; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com',
          timestamp: Date.now() + i
        });
      }

      const result = await rotation.checkAndRotate();

      expect(result.rotated).toBe(false);
      expect(result.reason).toBe('under_threshold');
      expect(result.count).toBe(80);
    });

    it('should rotate when at or above threshold', async () => {
      // Add 95 entries (over 90% of 100)
      for (let i = 0; i < 95; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com',
          timestamp: Date.now() + i
        });
      }

      const result = await rotation.checkAndRotate();

      expect(result.rotated).toBe(true);
      expect(result.deleted).toBeGreaterThan(0);
      expect(result.previousCount).toBe(95);
      expect(result.newCount).toBeLessThan(95);
    });

    it('should delete oldest entries first', async () => {
      // Add 95 entries with specific timestamps
      for (let i = 0; i < 95; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com',
          timestamp: 1000 + i // Oldest is 1000
        });
      }

      const result = await rotation.checkAndRotate();

      // Verify the oldest entries were deleted
      const entries = await storage.getEntries({ limit: 100 });
      const remainingIds = entries.map(e => e.timestamp);

      // Oldest should be gone
      expect(remainingIds).not.toContain(1000);
      expect(remainingIds).not.toContain(1001);
    });

    it('should handle rotation errors gracefully', async () => {
      // Mock storage.getCount to throw error
      const originalGetCount = storage.getCount.bind(storage);
      storage.getCount = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await rotation.checkAndRotate();

      expect(result.rotated).toBe(false);
      expect(result.error).toBe('Database error');

      // Restore
      storage.getCount = originalGetCount;
    });
  });

  describe('forceRotation', () => {
    it('should not rotate when already below target', async () => {
      // Add 50 entries
      for (let i = 0; i < 50; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      const result = await rotation.forceRotation(100);

      expect(result.rotated).toBe(false);
      expect(result.reason).toBe('already_below_target');
    });

    it('should rotate to target count', async () => {
      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      const result = await rotation.forceRotation(50);

      expect(result.rotated).toBe(true);
      expect(result.deleted).toBe(50);
      expect(result.targetCount).toBe(50);
      expect(result.previousCount).toBe(100);
      expect(result.newCount).toBe(50);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Add 50 entries
      for (let i = 0; i < 50; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      const stats = await rotation.getStats();

      expect(stats.currentEntries).toBe(50);
      expect(stats.maxEntries).toBe(100);
      expect(stats.utilization).toBe(0.5);
      expect(stats.shouldRotate).toBe(false);
    });

    it('should indicate rotation needed when at threshold', async () => {
      // Add 95 entries (over 90% of 100)
      for (let i = 0; i < 95; i++) {
        await storage.addEntry({
          originalText: `Entry ${i}`,
          translatedText: `Translated ${i}`,
          url: 'https://example.com'
        });
      }

      const stats = await rotation.getStats();

      expect(stats.shouldRotate).toBe(true);
      expect(stats.utilization).toBe(0.95);
    });
  });
});

export default StorageRotation;
