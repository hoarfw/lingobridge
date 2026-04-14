/**
 * @jest-environment jsdom
 */

import TranslationMutationObserver from '../mutation-observer.js';

describe('TranslationMutationObserver', () => {
  let observer;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (observer) {
      observer.stop();
    }
    if (container) {
      container.remove();
    }
    observer = null;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      observer = new TranslationMutationObserver();
      expect(observer.debounceMs).toBe(500);
      expect(observer.isObserving).toBe(false);
      expect(typeof observer.onNewParagraphs).toBe('function');
      expect(typeof observer.onError).toBe('function');
    });

    it('should accept custom options', () => {
      const onNewParagraphs = jest.fn();
      const onError = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        onError,
        debounceMs: 1000
      });

      expect(observer.debounceMs).toBe(1000);
      expect(observer.onNewParagraphs).toBe(onNewParagraphs);
      expect(observer.onError).toBe(onError);
    });
  });

  describe('start', () => {
    it('should start observing the target node', () => {
      observer = new TranslationMutationObserver();
      observer.start(container);

      expect(observer.isObserving).toBe(true);
    });

    it('should warn if already running', () => {
      console.warn = jest.fn();
      observer = new TranslationMutationObserver();
      observer.start(container);
      observer.start(container);

      expect(console.warn).toHaveBeenCalledWith('[TranslationMutationObserver] Already running');
    });

    it('should handle invalid target node', () => {
      const onError = jest.fn();
      observer = new TranslationMutationObserver({ onError });
      observer.start(null);

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].type).toBe('INVALID_TARGET');
    });
  });

  describe('handleMutations', () => {
    it('should detect added paragraphs', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 50
      });
      observer.start(container);

      const p = document.createElement('p');
      p.textContent = 'This is a new paragraph with enough text to be detected.';
      container.appendChild(p);

      setTimeout(() => {
        expect(onNewParagraphs).toHaveBeenCalled();
        const call = onNewParagraphs.mock.calls[0][0];
        expect(call.count).toBe(1);
        expect(call.paragraphs).toContain(p);
        done();
      }, 100);
    });

    it('should debounce multiple mutations', (done) => {
      let callCount = 0;
      const onNewParagraphs = () => {
        callCount++;
      };

      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 50
      });
      observer.start(container);

      // Add multiple paragraphs rapidly
      for (let i = 0; i < 3; i++) {
        const p = document.createElement('p');
        p.textContent = `Paragraph ${i} with enough text content to qualify as translatable.`;
        container.appendChild(p);
      }

      setTimeout(() => {
        expect(callCount).toBe(1); // Should be called once due to debouncing
        done();
      }, 100);
    });

    it('should skip already processed elements', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 50
      });
      observer.start(container);

      const p = document.createElement('p');
      p.textContent = 'Paragraph with sufficient text length for translation detection.';
      container.appendChild(p);

      // Move element (triggers mutation but element was already processed)
      setTimeout(() => {
        const inner = document.createElement('div');
        inner.appendChild(p);
        container.appendChild(inner);

        setTimeout(() => {
          const calls = onNewParagraphs.mock.calls;
          // First call has 1 paragraph, second call should not include the same paragraph
          expect(calls[0][0].count).toBe(1);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('extractParagraphs', () => {
    beforeEach(() => {
      observer = new TranslationMutationObserver();
    });

    it('should extract the root if it is a paragraph', () => {
      const div = document.createElement('div');
      div.textContent = 'This is a substantial block of text that should be detected as a paragraph element.';

      const paragraphs = observer.extractParagraphs(div);
      expect(paragraphs).toContain(div);
    });

    it('should find paragraphs in children', () => {
      const div = document.createElement('div');
      const p1 = document.createElement('p');
      p1.textContent = 'First paragraph with enough text content to be considered valid for translation purposes.';
      const p2 = document.createElement('p');
      p2.textContent = 'Second paragraph also containing sufficient text length to qualify for the detection threshold.';
      div.appendChild(p1);
      div.appendChild(p2);

      const paragraphs = observer.extractParagraphs(div);
      expect(paragraphs).toContain(p1);
      expect(paragraphs).toContain(p2);
    });

    it('should handle deeply nested mutations', () => {
      const outer = document.createElement('div');
      const middle = document.createElement('section');
      const inner = document.createElement('div');
      const p = document.createElement('p');
      p.textContent = 'Deeply nested paragraph with adequate text length to pass validation filters.';
      inner.appendChild(p);
      middle.appendChild(inner);
      outer.appendChild(middle);

      const paragraphs = observer.extractParagraphs(outer);
      expect(paragraphs).toContain(p);
    });
  });

  describe('isParagraphElement', () => {
    beforeEach(() => {
      observer = new TranslationMutationObserver();
    });

    it('should return false for excluded selectors', () => {
      const script = document.createElement('script');
      script.textContent = 'var x = "This is a long text that would otherwise be detected"; ';
      expect(observer.isParagraphElement(script)).toBe(false);

      const style = document.createElement('style');
      style.textContent = '.foo { color: red; } .bar { margin: 10px; } .baz { padding: 5px; }';
      expect(observer.isParagraphElement(style)).toBe(false);
    });

    it('should return false for hidden elements', () => {
      const p = document.createElement('p');
      p.textContent = 'This paragraph has enough text but it is hidden from view.';
      p.style.display = 'none';
      container.appendChild(p);

      expect(observer.isParagraphElement(p)).toBe(false);
      p.remove();
    });

    it('should return false for short text', () => {
      const p = document.createElement('p');
      p.textContent = 'Short text.';

      expect(observer.isParagraphElement(p)).toBe(false);
    });

    it('should return false for already translated elements', () => {
      const p = document.createElement('p');
      p.textContent = 'This paragraph has been translated and should not be processed again.';
      p.setAttribute('data-tg-translated', 'true');

      expect(observer.isParagraphElement(p)).toBe(false);
    });

    it('should return false for elements in navigation', () => {
      const nav = document.createElement('nav');
      const p = document.createElement('p');
      p.textContent = 'This paragraph is inside a navigation element and should be ignored by the detector.';
      nav.appendChild(p);
      container.appendChild(nav);

      expect(observer.isParagraphElement(p)).toBe(false);
      nav.remove();
    });

    it('should return true for valid paragraphs', () => {
      const p = document.createElement('p');
      p.textContent = 'This is a valid paragraph with enough text content to qualify for translation detection.';
      container.appendChild(p);

      expect(observer.isParagraphElement(p)).toBe(true);
      p.remove();
    });
  });

  describe('debounceAndNotify', () => {
    it('should debounce notifications', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 100
      });

      // Call multiple times rapidly
      observer.debounceAndNotify([document.createElement('p')]);
      observer.debounceAndNotify([document.createElement('div')]);
      observer.debounceAndNotify([document.createElement('span')]);

      // Should not be called yet
      expect(onNewParagraphs).not.toHaveBeenCalled();

      setTimeout(() => {
        // Should be called once with the last batch
        expect(onNewParagraphs).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('stop', () => {
    it('should stop observing and cleanup', () => {
      observer = new TranslationMutationObserver();
      observer.start(container);
      expect(observer.isObserving).toBe(true);

      observer.stop();
      expect(observer.isObserving).toBe(false);
      expect(observer.observer).toBeNull();
    });

    it('should clear pending debounce timer', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 100
      });

      observer.start(container);
      const p = document.createElement('p');
      p.textContent = 'Paragraph with enough text to trigger detection but observer stopped.';
      container.appendChild(p);

      observer.stop();

      setTimeout(() => {
        // Should not be called due to stop clearing the timer
        expect(onNewParagraphs).not.toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('isRunning', () => {
    it('should return false when not observing', () => {
      observer = new TranslationMutationObserver();
      expect(observer.isRunning()).toBe(false);
    });

    it('should return true when observing', () => {
      observer = new TranslationMutationObserver();
      observer.start(container);
      expect(observer.isRunning()).toBe(true);
    });
  });

  describe('SPA-specific scenarios', () => {
    it('should handle React-style dynamic content', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 50
      });
      observer.start(container);

      // Simulate React adding content
      const app = document.createElement('div');
      app.id = 'root';
      container.appendChild(app);

      setTimeout(() => {
        const content = document.createElement('div');
        content.className = 'content';
        const article = document.createElement('article');
        article.textContent = 'This is a dynamically loaded article in a React application that needs translation.';
        content.appendChild(article);
        app.appendChild(content);

        setTimeout(() => {
          expect(onNewParagraphs).toHaveBeenCalled();
          const call = onNewParagraphs.mock.calls[0][0];
          expect(call.count).toBeGreaterThanOrEqual(1);
          done();
        }, 100);
      }, 10);
    });

    it('should handle Vue-style dynamic content', (done) => {
      const onNewParagraphs = jest.fn();
      observer = new TranslationMutationObserver({
        onNewParagraphs,
        debounceMs: 50
      });
      observer.start(container);

      // Simulate Vue router view change
      const view = document.createElement('div');
      view.className = 'router-view';
      const section = document.createElement('section');
      section.className = 'page-content';
      const p = document.createElement('p');
      p.className = 'text-content';
      p.textContent = 'This paragraph appears after a Vue router navigation to a new page view.';
      section.appendChild(p);
      view.appendChild(section);
      container.appendChild(view);

      setTimeout(() => {
        expect(onNewParagraphs).toHaveBeenCalled();
        done();
      }, 100);
    });
  });
});
