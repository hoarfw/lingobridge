//**
 * Integration Test for Paragraph Detector and Shadow Renderer
 *
 * This test file can be run in the browser console on a test page
 * to verify that the paragraph detector and shadow renderer work together.
 *
 * Usage:
 * 1. Load this file in a test HTML page
 * 2. Open browser console
 * 3. Run: await runIntegrationTest()
 * 4. Check console output and visual results
 */

import { detectParagraphs, markTranslated } from './paragraph-detector.js';
import { ShadowRenderer } from './shadow-renderer.js';

/**
 * Run the full integration test
 * @returns {Object} Test results
 */
export async function runIntegrationTest() {
  console.log('🧪 Starting Integration Test...\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Detect paragraphs on page
  console.log('Test 1: Detecting paragraphs...');
  try {
    const paragraphs = detectParagraphs();
    console.log(`  ✓ Found ${paragraphs.length} paragraphs`);

    if (paragraphs.length > 0) {
      console.log(`  ✓ First paragraph text length: ${paragraphs[0].text.length}`);
      results.passed++;
      results.tests.push({ name: 'Paragraph Detection', status: 'PASSED', count: paragraphs.length });
    } else {
      console.log('  ⚠ No paragraphs found (may be expected on empty page)');
      results.tests.push({ name: 'Paragraph Detection', status: 'WARNING', count: 0 });
    }
  } catch (error) {
    console.error('  ✗ Paragraph detection failed:', error);
    results.failed++;
    results.tests.push({ name: 'Paragraph Detection', status: 'FAILED', error: error.message });
  }

  // Test 2: Create shadow DOM host
  console.log('\nTest 2: Creating shadow DOM host...');
  let testHost = null;
  try {
    // Create a test element
    const testElement = document.createElement('p');
    testElement.textContent = 'Test paragraph for shadow DOM creation with enough text to be valid.';
    testElement.id = 'test-paragraph';
    document.body.appendChild(testElement);

    const result = ShadowRenderer.createHost(testElement);

    if (result && result.host && result.shadowRoot) {
      testHost = result.host;
      console.log('  ✓ Shadow DOM host created');
      console.log(`  ✓ Host ID: ${result.hostId}`);
      results.passed++;
      results.tests.push({ name: 'Shadow DOM Creation', status: 'PASSED', hostId: result.hostId });
    } else {
      throw new Error('Shadow DOM creation returned null');
    }
  } catch (error) {
    console.error('  ✗ Shadow DOM creation failed:', error);
    results.failed++;
    results.tests.push({ name: 'Shadow DOM Creation', status: 'FAILED', error: error.message });
  }

  // Test 3: Apply styles
  console.log('\nTest 3: Applying styles...');
  try {
    if (testHost) {
      const shadowRoot = testHost.shadowRoot;
      ShadowRenderer.applyStyles(shadowRoot);

      const styleElement = shadowRoot.querySelector('style');
      if (styleElement) {
        console.log('  ✓ Styles applied to shadow DOM');
        console.log(`  ✓ Style content length: ${styleElement.textContent.length} chars`);
        results.passed++;
        results.tests.push({ name: 'Style Application', status: 'PASSED' });
      } else {
        throw new Error('Style element not found in shadow DOM');
      }
    } else {
      throw new Error('No test host available');
    }
  } catch (error) {
    console.error('  ✗ Style application failed:', error);
    results.failed++;
    results.tests.push({ name: 'Style Application', status: 'FAILED', error: error.message });
  }

  // Test 4: Render full translation
  console.log('\nTest 4: Rendering full translation...');
  let translationResult = null;
  try {
    const target = document.createElement('p');
    target.textContent = 'This is the target paragraph for the full translation rendering test.';
    target.id = 'translation-target';
    document.body.appendChild(target);

    translationResult = ShadowRenderer.renderTranslation(
      target,
      'This is the translated text that will be displayed in the shadow DOM container.'
    );

    if (translationResult && translationResult.host) {
      console.log('  ✓ Translation rendered');
      console.log(`  ✓ Host ID: ${translationResult.hostId}`);

      // Verify content
      const textElement = translationResult.container.querySelector('.tg-translation-text');
      if (textElement) {
        console.log(`  ✓ Translation text: "${textElement.textContent.substring(0, 50)}..."`);
      }

      // Verify target marked as translated
      if (target.getAttribute('data-tg-translated') === 'true') {
        console.log('  ✓ Target element marked as translated');
      }

      results.passed++;
      results.tests.push({
        name: 'Translation Rendering',
        status: 'PASSED',
        hostId: translationResult.hostId
      });
    } else {
      throw new Error('Translation rendering returned null');
    }
  } catch (error) {
    console.error('  ✗ Translation rendering failed:', error);
    results.failed++;
    results.tests.push({
      name: 'Translation Rendering',
      status: 'FAILED',
      error: error.message
    });
  }

  // Test 5: Copy and hide buttons
  console.log('\nTest 5: Copy and hide buttons...');
  try {
    if (translationResult && translationResult.controls) {
      const { copyBtn, closeBtn } = translationResult.controls;

      if (copyBtn) {
        console.log('  ✓ Copy button exists');
      }

      if (closeBtn) {
        console.log('  ✓ Hide button exists');
      }

      results.passed++;
      results.tests.push({ name: 'Button Controls', status: 'PASSED' });
    } else {
      throw new Error('Translation result does not have controls');
    }
  } catch (error) {
    console.error('  ✗ Button check failed:', error);
    results.failed++;
    results.tests.push({
      name: 'Button Controls',
      status: 'FAILED',
      error: error.message
    });
  }

  // Test 6: Integration - Detect and render
  console.log('\nTest 6: Integration - Detect paragraphs and render translations...');
  try {
    // Create test content
    document.body.innerHTML += `
      <div id="integration-test">
        <p>This is the first test paragraph with enough text content to be detected and translated.</p>
        <p>This is the second test paragraph with sufficient content for the detector to find it.</p>
      </div>
    `;

    // Detect paragraphs
    const paragraphs = detectParagraphs(document.getElementById('integration-test'));
    console.log(`  ✓ Detected ${paragraphs.length} paragraphs`);

    if (paragraphs.length > 0) {
      // Render translation for first paragraph
      const firstParagraph = paragraphs[0];
      const translation = ShadowRenderer.renderTranslation(
        firstParagraph.element,
        `Translated: ${firstParagraph.text.substring(0, 50)}...`
      );

      if (translation) {
        console.log('  ✓ Successfully rendered translation for detected paragraph');
        console.log(`  ✓ Host ID: ${translation.hostId}`);

        results.passed++;
        results.tests.push({
          name: 'Integration: Detect and Render',
          status: 'PASSED',
          paragraphsDetected: paragraphs.length
        });
      } else {
        throw new Error('Failed to render translation');
      }
    } else {
      throw new Error('No paragraphs detected');
    }
  } catch (error) {
    console.error('  ✗ Integration test failed:', error);
    results.failed++;
    results.tests.push({
      name: 'Integration: Detect and Render',
      status: 'FAILED',
      error: error.message
    });
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('INTEGRATION TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log('='.repeat(50));

  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check details above.');
  }

  console.log('\nTest Details:');
  results.tests.forEach((test, i) => {
    const icon = test.status === 'PASSED' ? '✓' : test.status === 'WARNING' ? '⚠' : '✗';
    console.log(`  ${i + 1}. [${icon}] ${test.name}: ${test.status}`);
  });

  return results;
}

// Export for module usage
export default runIntegrationTest;

// Auto-run if loaded in browser with ?autorun parameter
if (typeof window !== 'undefined' && window.location.search.includes('autorun')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runIntegrationTest);
  } else {
    runIntegrationTest();
  }
}
