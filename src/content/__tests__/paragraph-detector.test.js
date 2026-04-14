/**
 * Tests for paragraph-detector.js
 * @jest-environment jsdom
 */

import {
  detectParagraphs,
  markTranslated,
  isTranslated,
  getTranslatedElements,
  clearTranslationMarks
} from '../paragraph-detector.js';

describe('Paragraph Detector', () => {
  // Setup and teardown
  beforeEach(() => {
    // Clear the document body before each test
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('detectParagraphs', () => {
    test('detects simple paragraphs', () => {
      document.body.innerHTML = `
        <p>This is a paragraph with enough text to be considered translatable content.</p>
        <p>This is another paragraph that should also be detected by the detector.</p>
      `;

      const paragraphs = detectParagraphs();

      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].text).toContain('This is a paragraph');
      expect(paragraphs[1].text).toContain('This is another paragraph');
    });

    test('skips short text', () => {
      document.body.innerHTML = `
        <p>Short.</p>
        <p>This is a much longer paragraph that has enough text to be considered translatable and should definitely be detected by the system.</p>
      `;

      const paragraphs = detectParagraphs();

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].text).toContain('much longer paragraph');
    });

    test('skips already translated elements', () => {
      document.body.innerHTML = `
        <p>This paragraph has not been translated yet and should be detected.</p>
        <p data-tg-translated="true">This paragraph has already been translated and should be skipped.</p>
      `;

      const paragraphs = detectParagraphs();

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].text).toContain('not been translated');
    });

    test('handles nested elements', () => {
      document.body.innerHTML = `
        <article>
          <h2>Article Title</h2>
          <p>This is the first paragraph inside the article with plenty of text content.</p>
          <p>This is the second paragraph that also has sufficient text for translation.</p>
        </article>
      `;

      const paragraphs = detectParagraphs();

      // Should detect the article and the paragraphs within
      expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    });

    test('returns empty array when no content', () => {
      document.body.innerHTML = '';

      const paragraphs = detectParagraphs();

      expect(paragraphs).toEqual([]);
    });

    test('skips hidden elements', () => {
      document.body.innerHTML = `
        <p style="display: none;">This paragraph is hidden and should not be detected.</p>
        <p style="visibility: hidden;">This paragraph is also hidden and should not be detected.</p>
        <p>This paragraph is visible and should be detected because it has plenty of text content.</p>
      `;

      const paragraphs = detectParagraphs();

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].text).toContain('visible and should be detected');
    });

    test('respects custom options', () => {
      document.body.innerHTML = `
        <p>Short</p>
        <div>This is a div with plenty of text content that should be considered for translation.</div>
      `;

      // Only detect divs with shorter minimum length
      const paragraphs = detectParagraphs(document.body, {
        selectors: 'div',
        minLength: 10
      });

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].element.tagName.toLowerCase()).toBe('div');
    });
  });

  describe('markTranslated', () => {
    test('marks element as translated', () => {
      const element = document.createElement('p');
      markTranslated(element);

      expect(element.getAttribute('data-tg-translated')).toBe('true');
    });

    test('marks element with translation ID', () => {
      const element = document.createElement('p');
      markTranslated(element, 'test-translation-id');

      expect(element.getAttribute('data-tg-translated')).toBe('true');
      expect(element.getAttribute('data-tg-translation-id')).toBe('test-translation-id');
    });

    test('handles null element gracefully', () => {
      expect(() => markTranslated(null)).not.toThrow();
    });
  });

  describe('isTranslated', () => {
    test('returns true for translated element', () => {
      const element = document.createElement('p');
      element.setAttribute('data-tg-translated', 'true');

      expect(isTranslated(element)).toBe(true);
    });

    test('returns false for untranslated element', () => {
      const element = document.createElement('p');

      expect(isTranslated(element)).toBe(false);
    });

    test('returns false for null element', () => {
      expect(isTranslated(null)).toBe(false);
    });
  });

  describe('getTranslatedElements', () => {
    test('returns all translated elements', () => {
      document.body.innerHTML = `
        <p data-tg-translated="true">Translated 1</p>
        <p>Not translated</p>
        <p data-tg-translated="true">Translated 2</p>
      `;

      const elements = getTranslatedElements();

      expect(elements).toHaveLength(2);
    });

    test('returns empty array when no translated elements', () => {
      document.body.innerHTML = `
        <p>Not translated</p>
        <p>Also not translated</p>
      `;

      const elements = getTranslatedElements();

      expect(elements).toEqual([]);
    });

    test('returns empty array for null root', () => {
      const elements = getTranslatedElements(null);
      expect(elements).toEqual([]);
    });
  });

  describe('clearTranslationMarks', () => {
    test('removes translation marks from all elements', () => {
      document.body.innerHTML = `
        <p data-tg-translated="true" data-tg-translation-id="123">Translated 1</p>
        <p>Not translated</p>
        <p data-tg-translated="true" data-tg-translation-id="456">Translated 2</p>
      `;

      const count = clearTranslationMarks();

      expect(count).toBe(2);

      const translatedElements = document.querySelectorAll('[data-tg-translated]');
      expect(translatedElements).toHaveLength(0);
    });

    test('returns zero when no elements to clear', () => {
      document.body.innerHTML = `
        <p>Not translated</p>
        <p>Also not translated</p>
      `;

      const count = clearTranslationMarks();

      expect(count).toBe(0);
    });

    test('returns zero for null root', () => {
      const count = clearTranslationMarks(null);
      expect(count).toBe(0);
    });
  });
});
