/**
 * Tests for shadow-renderer.js
 * @jest-environment jsdom
 */

import { ShadowRenderer } from '../shadow-renderer.js';

describe('ShadowRenderer', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createHost', () => {
    test('creates shadow DOM host after element', () => {
      const target = document.createElement('p');
      target.textContent = 'Target paragraph with sufficient text content.';
      document.body.appendChild(target);

      const result = ShadowRenderer.createHost(target);

      expect(result).not.toBeNull();
      expect(result.host).toBeDefined();
      expect(result.shadowRoot).toBeDefined();
      expect(result.hostId).toMatch(/^tg-host-/);
      expect(result.host.getAttribute('data-tg-host')).toBe('true');
    });

    test('inserts host after target element', () => {
      const container = document.createElement('div');
      const target = document.createElement('p');
      target.textContent = 'Target with enough text for detection.';
      container.appendChild(target);
      document.body.appendChild(container);

      ShadowRenderer.createHost(target);

      expect(target.nextSibling).not.toBeNull();
      expect(target.nextSibling.getAttribute('data-tg-host')).toBe('true');
    });

    test('returns null for invalid element', () => {
      const result = ShadowRenderer.createHost(null);
      expect(result).toBeNull();
    });

    test('returns null for element without parent', () => {
      const orphan = document.createElement('p');
      orphan.textContent = 'Orphan with enough text content for detection.';
      const result = ShadowRenderer.createHost(orphan);
      expect(result).toBeNull();
    });
  });

  describe('removeHost', () => {
    test('removes host by element reference', () => {
      const target = document.createElement('p');
      target.textContent = 'Target with sufficient text content for testing.';
      document.body.appendChild(target);

      const { host } = ShadowRenderer.createHost(target);
      expect(document.getElementById(host.id)).not.toBeNull();

      const result = ShadowRenderer.removeHost(host);

      expect(result).toBe(true);
      expect(document.getElementById(host.id)).toBeNull();
    });

    test('removes host by ID string', () => {
      const target = document.createElement('p');
      target.textContent = 'Target with sufficient text content for testing.';
      document.body.appendChild(target);

      const { host, hostId } = ShadowRenderer.createHost(target);

      const result = ShadowRenderer.removeHost(hostId);

      expect(result).toBe(true);
      expect(document.getElementById(host.id)).toBeNull();
    });

    test('returns false for non-existent host', () => {
      const result = ShadowRenderer.removeHost('non-existent-id');
      expect(result).toBe(false);
    });

    test('returns false for null input', () => {
      const result = ShadowRenderer.removeHost(null);
      expect(result).toBe(false);
    });
  });

  describe('applyStyles', () => {
    test('applies default styles to shadow root', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const shadowRoot = div.attachShadow({ mode: 'open' });

      ShadowRenderer.applyStyles(shadowRoot);

      const styleElement = shadowRoot.querySelector('style');
      expect(styleElement).not.toBeNull();
      expect(styleElement.textContent).toContain(':host');
      expect(styleElement.textContent).toContain('.tg-translation-container');
    });

    test('applies custom styles along with default', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const shadowRoot = div.attachShadow({ mode: 'open' });

      const customStyles = '.custom-class { color: red; }';
      ShadowRenderer.applyStyles(shadowRoot, customStyles);

      const styleElement = shadowRoot.querySelector('style');
      expect(styleElement.textContent).toContain('.custom-class');
      expect(styleElement.textContent).toContain(':host');
    });

    test('warns when shadow root is null', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      ShadowRenderer.applyStyles(null);

      expect(consoleSpy).toHaveBeenCalledWith('ShadowRenderer: No shadow root provided');

      consoleSpy.mockRestore();
    });
  });

  describe('createContainer', () => {
    test('creates container in shadow root', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const shadowRoot = div.attachShadow({ mode: 'open' });

      const container = ShadowRenderer.createContainer(shadowRoot, 'test-container');

      expect(container).not.toBeNull();
      expect(container.className).toBe('test-container');
      expect(shadowRoot.contains(container)).toBe(true);
    });

    test('uses default class name when not specified', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      const shadowRoot = div.attachShadow({ mode: 'open' });

      const container = ShadowRenderer.createContainer(shadowRoot);

      expect(container.className).toBe('tg-translation-container');
    });

    test('returns null when shadow root is null', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const container = ShadowRenderer.createContainer(null);

      expect(container).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('ShadowRenderer: No shadow root provided');

      consoleSpy.mockRestore();
    });
  });

  describe('renderTranslation', () => {
    test('renders full translation display', () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation detection.';
      document.body.appendChild(target);

      const result = ShadowRenderer.renderTranslation(target, 'Translated text content.');

      expect(result).not.toBeNull();
      expect(result.host).toBeDefined();
      expect(result.container).toBeDefined();
      expect(result.hostId).toMatch(/^tg-host-/);

      // Verify translation content
      const translationText = result.container.querySelector('.tg-translation-text');
      expect(translationText.textContent).toBe('Translated text content.');

      // Verify header
      const headerLabel = result.container.querySelector('.tg-translation-label');
      expect(headerLabel.textContent).toContain('Translation');

      // Verify buttons exist
      expect(result.container.querySelector('.tg-copy-btn')).not.toBeNull();
      expect(result.container.querySelector('.tg-close-btn')).not.toBeNull();
    });

    test('marks original element as translated', () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation.';
      document.body.appendChild(target);

      ShadowRenderer.renderTranslation(target, 'Translated.');

      expect(target.getAttribute('data-tg-translated')).toBe('true');
      expect(target.getAttribute('data-tg-host-id')).toMatch(/^tg-host-/);
    });

    test('returns null for missing parameters', () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation.';
      document.body.appendChild(target);

      expect(ShadowRenderer.renderTranslation(null, 'Translation')).toBeNull();
      expect(ShadowRenderer.renderTranslation(target, null)).toBeNull();
      expect(ShadowRenderer.renderTranslation(target, '')).toBeNull();
    });

    test('escapes HTML in translation text', () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation.';
      document.body.appendChild(target);

      const result = ShadowRenderer.renderTranslation(
        target,
        '<script>alert("XSS")</script>'
      );

      const translationText = result.container.querySelector('.tg-translation-text');
      expect(translationText.innerHTML).not.toContain('<script>');
      expect(translationText.textContent).toContain('alert');
    });

    test('copy button copies text to clipboard', async () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation.';
      document.body.appendChild(target);

      const result = ShadowRenderer.renderTranslation(target, 'Text to copy');

      // Mock clipboard API
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      // Click copy button
      result.controls.copyBtn.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Text to copy');
    });

    test('hide button removes the translation', () => {
      const target = document.createElement('p');
      target.textContent = 'Original text with enough content for translation.';
      document.body.appendChild(target);

      const result = ShadowRenderer.renderTranslation(target, 'Translation');
      const hostId = result.hostId;

      // Verify host exists
      expect(document.getElementById(hostId)).not.toBeNull();

      // Click hide button
      result.controls.closeBtn.click();

      // Verify host is removed
      expect(document.getElementById(hostId)).toBeNull();
    });
  });

  describe('getDefaultStyles', () => {
    test('returns default styles string', () => {
      const styles = ShadowRenderer.getDefaultStyles();

      expect(typeof styles).toBe('string');
      expect(styles).toContain(':host');
      expect(styles).toContain('.tg-translation-container');
      expect(styles).toContain('border-left');
    });
  });

  describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
      const input = '<script>alert("test")</script>';
      const result = ShadowRenderer.escapeHtml(input);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('handles empty string', () => {
      expect(ShadowRenderer.escapeHtml('')).toBe('');
    });

    test('handles null', () => {
      expect(ShadowRenderer.escapeHtml(null)).toBe('');
    });

    test('handles undefined', () => {
      expect(ShadowRenderer.escapeHtml(undefined)).toBe('');
    });
  });
});
