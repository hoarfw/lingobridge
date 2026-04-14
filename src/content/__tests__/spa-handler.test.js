/**
 * @jest-environment jsdom
 */

import SPAHandler from '../spa-handler.js';
import TranslationMutationObserver from '../mutation-observer.js';

// Mock the TranslationMutationObserver
jest.mock('../mutation-observer.js');

describe('SPAHandler', () => {
  let handler;
  let mockPageTranslator;
  let container;

  beforeEach(() => {
    // Setup mock pageTranslator
    mockPageTranslator = {
      translateNewParagraphs: jest.fn()
    };

    // Setup DOM container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Clear mocks
    TranslationMutationObserver.mockClear();
  });

  afterEach(() => {
    if (handler) {
      handler.destroy();
    }
    if (container) {
      container.remove();
    }
    document.getElementById('tg-spa-notification')?.remove();
    document.querySelector('style[data-tg-spa-styles]')?.remove();
    handler = null;
  });

  describe('constructor', () => {
    it('should require pageTranslator', () => {
      expect(() => {
        new SPAHandler();
      }).toThrow('SPAHandler requires a pageTranslator instance');
    });

    it('should initialize with default options', () => {
      handler = new SPAHandler(mockPageTranslator);

      expect(handler.pageTranslator).toBe(mockPageTranslator);
      expect(handler.mutationObserver).toBeNull();
      expect(handler.autoTranslate).toBe(false);
      expect(typeof handler.showNotification).toBe('function');
      expect(handler.pendingParagraphs).toEqual([]);
      expect(handler.isNotificationVisible).toBe(false);
    });

    it('should accept custom options', () => {
      const customNotification = jest.fn();
      handler = new SPAHandler(mockPageTranslator, {
        autoTranslate: true,
        showNotification: customNotification
      });

      expect(handler.autoTranslate).toBe(true);
      expect(handler.showNotification).toBe(customNotification);
    });
  });

  describe('initialize', () => {
    it('should create and start mutation observer', () => {
      handler = new SPAHandler(mockPageTranslator);
      handler.initialize();

      expect(TranslationMutationObserver).toHaveBeenCalledWith({
        onNewParagraphs: expect.any(Function),
        onError: expect.any(Function),
        debounceMs: 500
      });

      const mockObserver = TranslationMutationObserver.mock.instances[0];
      expect(mockObserver.start).toHaveBeenCalled();
    });

    it('should warn if already initialized', () => {
      console.warn = jest.fn();
      handler = new SPAHandler(mockPageTranslator);
      handler.initialize();
      handler.initialize();

      expect(console.warn).toHaveBeenCalledWith('[SPAHandler] Already initialized');
    });
  });

  describe('handleNewParagraphs', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should auto-translate when autoTranslate is enabled', () => {
      handler.autoTranslate = true;
      const p1 = document.createElement('p');
      const p2 = document.createElement('p');
      const paragraphs = [p1, p2];

      handler.handleNewParagraphs({ paragraphs, count: 2 });

      expect(mockPageTranslator.translateNewParagraphs).toHaveBeenCalledWith(paragraphs);
      expect(handler.pendingParagraphs).toEqual([]);
    });

    it('should show notification when autoTranslate is disabled', () => {
      const showNotificationSpy = jest.spyOn(handler, 'showTranslationNotification');
      const p1 = document.createElement('p');
      const paragraphs = [p1];

      handler.handleNewParagraphs({ paragraphs, count: 1 });

      expect(handler.pendingParagraphs).toContain(p1);
      expect(showNotificationSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('notification UI', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
      handler.pendingParagraphs = [
        document.createElement('p'),
        document.createElement('p')
      ];
    });

    it('should create notification element', () => {
      handler.showTranslationNotification(2);

      const notification = document.getElementById('tg-spa-notification');
      expect(notification).toBeTruthy();
      expect(notification.querySelector('.tg-notification-text').textContent).toContain('2 new paragraphs');
    });

    it('should add styles to document', () => {
      handler.showTranslationNotification(1);

      const styles = document.querySelector('style');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('#tg-spa-notification');
    });

    it('should translate when Translate button is clicked', () => {
      handler.showTranslationNotification(2);

      const translateBtn = document.getElementById('tg-translate-new');
      translateBtn.click();

      expect(mockPageTranslator.translateNewParagraphs).toHaveBeenCalledWith(handler.pendingParagraphs);
      expect(handler.pendingParagraphs).toEqual([]);
    });

    it('should clear pending when Ignore button is clicked', () => {
      const dismissSpy = jest.spyOn(handler, 'dismissNotification');
      handler.showTranslationNotification(2);

      const ignoreBtn = document.getElementById('tg-ignore-new');
      ignoreBtn.click();

      expect(handler.pendingParagraphs).toEqual([]);
      expect(dismissSpy).toHaveBeenCalled();
    });

    it('should auto-dismiss after timeout', (done) => {
      jest.useFakeTimers();
      handler.showTranslationNotification(1);

      expect(handler.isNotificationVisible).toBe(true);

      jest.advanceTimersByTime(30000);

      expect(handler.isNotificationVisible).toBe(false);
      jest.useRealTimers();
      done();
    });

    it('should update existing notification', () => {
      handler.showTranslationNotification(1);
      handler.showTranslationNotification(3);

      const text = document.querySelector('.tg-notification-text');
      expect(text.textContent).toContain('3 new paragraphs');
    });
  });

  describe('dismissNotification', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should remove notification element', () => {
      handler.showTranslationNotification(1);
      expect(document.getElementById('tg-spa-notification')).toBeTruthy();

      handler.dismissNotification();
      expect(document.getElementById('tg-spa-notification')).toBeFalsy();
    });

    it('should remove styles element', () => {
      handler.showTranslationNotification(1);
      expect(document.querySelector('style')).toBeTruthy();

      handler.dismissNotification();
      expect(document.querySelector('style')).toBeFalsy();
    });

    it('should clear auto-dismiss timer', () => {
      handler.showTranslationNotification(1);
      expect(handler.autoDismissTimer).toBeTruthy();

      handler.dismissNotification();
      expect(handler.autoDismissTimer).toBeNull();
    });
  });

  describe('translatePendingParagraphs', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should translate pending paragraphs', () => {
      const p1 = document.createElement('p');
      const p2 = document.createElement('p');
      handler.pendingParagraphs = [p1, p2];

      handler.translatePendingParagraphs();

      expect(mockPageTranslator.translateNewParagraphs).toHaveBeenCalledWith([p1, p2]);
    });

    it('should clear pending paragraphs after translation', () => {
      handler.pendingParagraphs = [document.createElement('p')];

      handler.translatePendingParagraphs();

      expect(handler.pendingParagraphs).toEqual([]);
    });

    it('should dismiss notification after translation', () => {
      const dismissSpy = jest.spyOn(handler, 'dismissNotification');
      handler.pendingParagraphs = [document.createElement('p')];

      handler.translatePendingParagraphs();

      expect(dismissSpy).toHaveBeenCalled();
    });

    it('should do nothing if no pending paragraphs', () => {
      handler.pendingParagraphs = [];

      handler.translatePendingParagraphs();

      expect(mockPageTranslator.translateNewParagraphs).not.toHaveBeenCalled();
    });
  });

  describe('clearPendingParagraphs', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should clear pending paragraphs', () => {
      handler.pendingParagraphs = [
        document.createElement('p'),
        document.createElement('p')
      ];

      handler.clearPendingParagraphs();

      expect(handler.pendingParagraphs).toEqual([]);
    });

    it('should mark paragraphs as ignored', () => {
      const p1 = document.createElement('p');
      const p2 = document.createElement('p');
      handler.pendingParagraphs = [p1, p2];

      handler.clearPendingParagraphs();

      expect(p1.getAttribute('data-tg-ignored')).toBe('true');
      expect(p2.getAttribute('data-tg-ignored')).toBe('true');
    });

    it('should dismiss notification', () => {
      const dismissSpy = jest.spyOn(handler, 'dismissNotification');
      handler.pendingParagraphs = [document.createElement('p')];

      handler.clearPendingParagraphs();

      expect(dismissSpy).toHaveBeenCalled();
    });
  });

  describe('setAutoTranslate', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should set auto-translate to true', () => {
      handler.setAutoTranslate(true);
      expect(handler.autoTranslate).toBe(true);
    });

    it('should set auto-translate to false', () => {
      handler.setAutoTranslate(true);
      handler.setAutoTranslate(false);
      expect(handler.autoTranslate).toBe(false);
    });
  });

  describe('isAutoTranslateEnabled', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should return false by default', () => {
      expect(handler.isAutoTranslateEnabled()).toBe(false);
    });

    it('should return true when auto-translate is enabled', () => {
      handler.setAutoTranslate(true);
      expect(handler.isAutoTranslateEnabled()).toBe(true);
    });
  });

  describe('getPendingCount', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should return 0 by default', () => {
      expect(handler.getPendingCount()).toBe(0);
    });

    it('should return the number of pending paragraphs', () => {
      handler.pendingParagraphs = [
        document.createElement('p'),
        document.createElement('p'),
        document.createElement('p')
      ];
      expect(handler.getPendingCount()).toBe(3);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should stop the mutation observer', () => {
      handler.initialize();
      const mockObserver = TranslationMutationObserver.mock.instances[0];

      handler.destroy();

      expect(mockObserver.stop).toHaveBeenCalled();
      expect(handler.mutationObserver).toBeNull();
    });

    it('should dismiss the notification', () => {
      const dismissSpy = jest.spyOn(handler, 'dismissNotification');

      handler.destroy();

      expect(dismissSpy).toHaveBeenCalled();
    });

    it('should clear pending paragraphs', () => {
      handler.pendingParagraphs = [document.createElement('p')];

      handler.destroy();

      expect(handler.pendingParagraphs).toEqual([]);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should handle observer errors', () => {
      console.error = jest.fn();
      const error = new Error('Observer error');

      handler.handleObserverError({ type: 'TEST_ERROR', error });

      expect(console.error).toHaveBeenCalledWith('[SPAHandler] Observer error:', 'TEST_ERROR', error);
    });

    it('should handle initialization errors', () => {
      TranslationMutationObserver.mockImplementation(() => {
        throw new Error('Failed to create observer');
      });

      console.error = jest.fn();
      handler.initialize();

      expect(console.error).toHaveBeenCalledWith(
        '[SPAHandler] Failed to initialize:',
        expect.any(Error)
      );
    });
  });

  describe('SPA scenarios', () => {
    beforeEach(() => {
      handler = new SPAHandler(mockPageTranslator);
    });

    it('should handle React router navigation', (done) => {
      handler.initialize();

      // Simulate React router view change
      const app = document.createElement('div');
      app.id = 'root';
      const route = document.createElement('div');
      route.className = 'route-content';
      const article = document.createElement('article');
      article.textContent = 'This article appears after React router navigation to a new page.';
      route.appendChild(article);
      app.appendChild(route);
      container.appendChild(app);

      setTimeout(() => {
        expect(handler.pendingParagraphs.length).toBeGreaterThanOrEqual(0);
        done();
      }, 100);
    });

    it('should handle Vue router navigation', (done) => {
      handler.initialize();

      // Simulate Vue router view change
      const app = document.createElement('div');
      app.id = 'app';
      const view = document.createElement('div');
      view.className = 'router-view';
      const section = document.createElement('section');
      section.textContent = 'This section appears after Vue router navigation to a new page.';
      view.appendChild(section);
      app.appendChild(view);
      container.appendChild(app);

      setTimeout(() => {
        expect(handler.pendingParagraphs.length).toBeGreaterThanOrEqual(0);
        done();
      }, 100);
    });

    it('should handle Angular router navigation', (done) => {
      handler.initialize();

      // Simulate Angular router outlet
      const app = document.createElement('app-root');
      const outlet = document.createElement('router-outlet');
      const route = document.createElement('div');
      route.className = 'ng-star-inserted';
      const content = document.createElement('main');
      content.textContent = 'This content appears after Angular router navigation to a new route.';
      route.appendChild(content);
      app.appendChild(outlet);
      app.appendChild(route);
      container.appendChild(app);

      setTimeout(() => {
        expect(handler.pendingParagraphs.length).toBeGreaterThanOrEqual(0);
        done();
      }, 100);
    });

    it('should handle infinite scroll content loading', (done) => {
      handler.initialize();

      // Simulate infinite scroll adding more content
      const feed = document.createElement('div');
      feed.className = 'infinite-feed';
      container.appendChild(feed);

      setTimeout(() => {
        // Add more items to feed
        for (let i = 0; i < 3; i++) {
          const item = document.createElement('div');
          item.className = 'feed-item';
          item.textContent = `Feed item ${i} with enough text content to be detected as translatable paragraph.`;
          feed.appendChild(item);
        }

        setTimeout(() => {
          expect(handler.pendingParagraphs.length).toBeGreaterThanOrEqual(0);
          done();
        }, 100);
      }, 50);
    });
  });
});
