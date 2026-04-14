/**
 * Tests for translation-queue.js
 * @jest-environment jsdom
 */

import { TranslationQueue } from '../translation-queue.js';

// Mock OllamaClient
class MockOllamaClient {
  constructor(options = {}) {
    this.shouldFail = options.shouldFail || false;
    this.failCount = options.failCount || 0;
    this.failAttempts = 0;
    this.delay = options.delay || 0;
  }

  async translateParagraph(text, options = {}) {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      this.failAttempts++;
      if (this.failAttempts <= this.failCount) {
        throw new Error('Translation failed');
      }
    }

    return {
      translation: `Translated: ${text}`,
      success: true,
      duration: 100
    };
  }
}

describe('TranslationQueue', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockOllamaClient();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('creates queue with default options', () => {
      const queue = new TranslationQueue(mockClient);

      expect(queue.ollama).toBe(mockClient);
      expect(queue.concurrency).toBe(1);
      expect(queue.delayBetween).toBe(100);
      expect(queue.maxRetries).toBe(2);
      expect(queue.isRunning).toBe(false);
    });

    test('creates queue with custom options', () => {
      const queue = new TranslationQueue(mockClient, {
        concurrency: 2,
        delayBetween: 500,
        maxRetries: 5,
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      });

      expect(queue.concurrency).toBe(2);
      expect(queue.delayBetween).toBe(500);
      expect(queue.maxRetries).toBe(5);
      expect(typeof queue.onProgress).toBe('function');
      expect(typeof queue.onComplete).toBe('function');
      expect(typeof queue.onError).toBe('function');
    });
  });

  describe('addParagraphs', () => {
    test('adds paragraphs to queue', () => {
      const queue = new TranslationQueue(mockClient);

      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' },
        { element: document.createElement('p'), text: 'Paragraph 2' }
      ];

      queue.addParagraphs(paragraphs);

      expect(queue.queue).toHaveLength(2);
      expect(queue.queue[0].text).toBe('Paragraph 1');
      expect(queue.queue[1].text).toBe('Paragraph 2');
    });

    test('skips duplicate elements', () => {
      const queue = new TranslationQueue(mockClient);

      const element = document.createElement('p');
      const paragraphs = [
        { element, text: 'Paragraph 1' },
        { element, text: 'Paragraph 1 duplicate' }
      ];

      queue.addParagraphs(paragraphs);

      expect(queue.queue).toHaveLength(1);
    });

    test('returns queue instance for chaining', () => {
      const queue = new TranslationQueue(mockClient);
      const result = queue.addParagraphs([]);

      expect(result).toBe(queue);
    });
  });

  describe('processQueue', () => {
    test('processes queue successfully', async () => {
      const onProgress = jest.fn();
      const onComplete = jest.fn();

      const queue = new TranslationQueue(mockClient, {
        onProgress,
        onComplete,
        delayBetween: 0
      });

      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' },
        { element: document.createElement('p'), text: 'Paragraph 2' }
      ];

      queue.addParagraphs(paragraphs);
      await queue.start();

      expect(onComplete).toHaveBeenCalled();
      expect(onComplete.mock.calls[0][0].completed).toBe(2);
    });

    test('handles translation failures with retry', async () => {
      const failingClient = new MockOllamaClient({ shouldFail: true, failCount: 1 });
      const onError = jest.fn();

      const queue = new TranslationQueue(failingClient, {
        onError,
        maxRetries: 2,
        delayBetween: 0
      });

      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' }
      ];

      queue.addParagraphs(paragraphs);
      await queue.start();

      // After retries, should be in failed state
      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
    });

    test('handles pause and resume', async () => {
      const queue = new TranslationQueue(mockClient, {
        delayBetween: 0
      });

      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' },
        { element: document.createElement('p'), text: 'Paragraph 2' },
        { element: document.createElement('p'), text: 'Paragraph 3' }
      ];

      queue.addParagraphs(paragraphs);

      // Start and immediately pause
      const startPromise = queue.start();
      queue.pause();

      expect(queue.isRunning).toBe(false);

      // Resume
      queue.resume();

      await startPromise;

      const stats = queue.getStats();
      expect(stats.completed).toBe(3);
    });
  });

  describe('getStats', () => {
    test('returns correct stats', () => {
      const queue = new TranslationQueue(mockClient);

      // Initially empty
      let stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(0);

      // Add paragraphs
      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' },
        { element: document.createElement('p'), text: 'Paragraph 2' }
      ];

      queue.addParagraphs(paragraphs);

      stats = queue.getStats();
      expect(stats.pending).toBe(2);
      expect(stats.total).toBe(2);
    });
  });

  describe('clear', () => {
    test('clears all state', () => {
      const queue = new TranslationQueue(mockClient);

      const paragraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' }
      ];

      queue.addParagraphs(paragraphs);
      queue.clear();

      expect(queue.queue).toHaveLength(0);
      expect(queue.processing.size).toBe(0);
      expect(queue.completed.size).toBe(0);
      expect(queue.failed.size).toBe(0);
      expect(queue.isRunning).toBe(false);
    });
  });
});