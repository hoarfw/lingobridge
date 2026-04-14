/**
 * Tests for page-translator.js
 * @jest-environment jsdom
 */

import { PageTranslator } from '../page-translator.js';
import { TranslationQueue } from '../translation-queue.js';

// Mock dependencies
jest.mock('../translation-queue.js');
jest.mock('../paragraph-detector.js', () => ({
  detectParagraphs: jest.fn(),
  markTranslated: jest.fn()
}));
jest.mock('../shadow-renderer.js', () => ({
  ShadowRenderer: {
    renderTranslation: jest.fn(),
    removeHost: jest.fn()
  }
}));

import { detectParagraphs, markTranslated } from '../paragraph-detector.js';
import { ShadowRenderer } from '../shadow-renderer.js';

// Mock OllamaClient
class MockOllamaClient {
  async translateParagraph(text) {
    return {
      translation: `Translated: ${text}`,
      success: true,
      duration: 100
    };
  }
}

describe('PageTranslator', () => {
  let mockClient;
  let translator;

  beforeEach(() => {
    mockClient = new MockOllamaClient();
    translator = new PageTranslator({
      ollamaClient: mockClient
    });
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    test('creates translator with default options', () => {
      const t = new PageTranslator();

      expect(t.ollamaClient).toBeUndefined();
      expect(typeof t.onProgress).toBe('function');
      expect(typeof t.onComplete).toBe('function');
      expect(typeof t.onError).toBe('function');
      expect(t.isTranslating).toBe(false);
    });

    test('creates translator with custom options', () => {
      const onProgress = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const t = new PageTranslator({
        ollamaClient: mockClient,
        onProgress,
        onComplete,
        onError
      });

      expect(t.ollamaClient).toBe(mockClient);
      expect(t.onProgress).toBe(onProgress);
      expect(t.onComplete).toBe(onComplete);
      expect(t.onError).toBe(onError);
    });
  });

  describe('translatePage', () => {
    test('throws if translation already in progress', async () => {
      translator.isTranslating = true;

      await expect(translator.translatePage()).rejects.toThrow('Translation already in progress');
    });

    test('completes immediately if no paragraphs found', async () => {
      detectParagraphs.mockReturnValue([]);

      const onComplete = jest.fn();
      translator.onComplete = onComplete;

      await translator.translatePage();

      expect(onComplete).toHaveBeenCalledWith({
        translated: 0,
        message: 'No translatable content found'
      });
    });

    test('detects and translates paragraphs', async () => {
      const mockParagraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' },
        { element: document.createElement('p'), text: 'Paragraph 2' }
      ];

      detectParagraphs.mockReturnValue(mockParagraphs);

      // Mock TranslationQueue
      const mockQueue = {
        addParagraphs: jest.fn(),
        start: jest.fn().mockResolvedValue(undefined)
      };
      TranslationQueue.mockImplementation(() => mockQueue);

      const onProgress = jest.fn();
      translator.onProgress = onProgress;

      await translator.translatePage();

      // Should have detected paragraphs
      expect(detectParagraphs).toHaveBeenCalled();

      // Should have created queue
      expect(TranslationQueue).toHaveBeenCalled();

      // Should have added paragraphs to queue
      expect(mockQueue.addParagraphs).toHaveBeenCalledWith(mockParagraphs);

      // Should have started queue
      expect(mockQueue.start).toHaveBeenCalled();
    });

    test('reports progress during translation', async () => {
      const mockParagraphs = [
        { element: document.createElement('p'), text: 'Paragraph 1' }
      ];

      detectParagraphs.mockReturnValue(mockParagraphs);

      const progressCallbacks = [];

      // Mock TranslationQueue that captures progress callbacks
      TranslationQueue.mockImplementation((client, options) => {
        // Store the callbacks for later invocation
        if (options.onProgress) {
          progressCallbacks.push(options.onProgress);
        }

        return {
          addParagraphs: jest.fn(),
          start: jest.fn().mockImplementation(() => {
            // Simulate progress callback
            if (progressCallbacks.length > 0) {
              progressCallbacks[0]({
                type: 'completed',
                item: { id: 'test-item' },
                completed: 1,
                total: 1
              });
            }
            return Promise.resolve();
          })
        };
      });

      const onProgress = jest.fn();
      translator.onProgress = onProgress;

      await translator.translatePage();

      // Should have received progress updates
      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.stage).toBe('translating');
    });
  });

  describe('detectParagraphs', () => {
    test('calls paragraph detector with correct options', () => {
      detectParagraphs.mockReturnValue([]);

      translator.detectParagraphs(document.body);

      expect(detectParagraphs).toHaveBeenCalledWith(document.body, {
        selectors: 'p, article, section, div',
        minLength: 20,
        skipHidden: true,
        skipTranslated: true
      });
    });

    test('uses document.body as default', () => {
      detectParagraphs.mockReturnValue([]);

      translator.detectParagraphs();

      expect(detectParagraphs).toHaveBeenCalledWith(document.body, expect.any(Object));
    });
  });

  describe('pause and resume', () => {
    test('pauses queue', () => {
      const mockQueue = { pause: jest.fn() };
      translator.queue = mockQueue;

      translator.pause();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    test('resumes queue', () => {
      const mockQueue = { resume: jest.fn() };
      translator.queue = mockQueue;

      translator.resume();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('getProgress', () => {
    test('returns zero stats when queue not initialized', () => {
      const progress = translator.getProgress();

      expect(progress.pending).toBe(0);
      expect(progress.processing).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.failed).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.isTranslating).toBe(false);
    });

    test('returns queue stats when queue exists', () => {
      translator.queue = {
        getStats: jest.fn().mockReturnValue({
          pending: 2,
          processing: 1,
          completed: 5,
          failed: 1,
          total: 9
        })
      };
      translator.translatedCount = 5;
      translator.isTranslating = true;

      const progress = translator.getProgress();

      expect(progress.pending).toBe(2);
      expect(progress.processing).toBe(1);
      expect(progress.completed).toBe(5);
      expect(progress.failed).toBe(1);
      expect(progress.total).toBe(9);
      expect(progress.translatedCount).toBe(5);
      expect(progress.isTranslating).toBe(true);
    });
  });

  describe('renderTranslation', () => {
    test('renders translation using ShadowRenderer', () => {
      const mockElement = document.createElement('p');
      const mockItem = {
        id: 'test-id',
        element: mockElement,
        translation: 'Translated text'
      };

      ShadowRenderer.renderTranslation.mockReturnValue({
        hostId: 'host-123',
        container: document.createElement('div')
      });

      translator.renderTranslation(mockItem);

      expect(ShadowRenderer.renderTranslation).toHaveBeenCalledWith(
        mockElement,
        'Translated text',
        { customStyles: '' }
      );
      expect(markTranslated).toHaveBeenCalledWith(mockElement, 'test-id');
    });

    test('handles missing element gracefully', () => {
      const mockItem = {
        id: 'test-id',
        element: null,
        translation: 'Translated text'
      };

      // Should not throw
      expect(() => translator.renderTranslation(mockItem)).not.toThrow();
      expect(ShadowRenderer.renderTranslation).not.toHaveBeenCalled();
    });

    test('handles missing translation gracefully', () => {
      const mockElement = document.createElement('p');
      const mockItem = {
        id: 'test-id',
        element: mockElement,
        translation: null
      };

      // Should not throw
      expect(() => translator.renderTranslation(mockItem)).not.toThrow();
      expect(ShadowRenderer.renderTranslation).not.toHaveBeenCalled();
    });
  });

  describe('clearTranslations', () => {
    test('clears all translation hosts', () => {
      ShadowRenderer.removeHost.mockReturnValue(true);

      translator.translationHosts.set('item-1', { hostId: 'host-1' });
      translator.translationHosts.set('item-2', { hostId: 'host-2' });

      const count = translator.clearTranslations();

      expect(count).toBe(2);
      expect(ShadowRenderer.removeHost).toHaveBeenCalledWith('host-1');
      expect(ShadowRenderer.removeHost).toHaveBeenCalledWith('host-2');
      expect(translator.translationHosts.size).toBe(0);
    });

    test('handles failed removals gracefully', () => {
      ShadowRenderer.removeHost.mockReturnValue(false);

      translator.translationHosts.set('item-1', { hostId: 'host-1' });

      const count = translator.clearTranslations();

      expect(count).toBe(0);
    });
  });
});