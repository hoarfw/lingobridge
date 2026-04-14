/**
 * Options page JavaScript - Handles settings form, provider switching, connection test, and save functionality
 */

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-DBG ${ts}] [${tag}]`, 'color:#0af;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-DBG ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

// DOM Elements
const elements = {
  provider: document.getElementById('provider'),
  ollamaUrl: document.getElementById('ollama-url'),
  modelName: document.getElementById('model-name'),
  apiKey: document.getElementById('api-key'),
  apiKeyGroup: document.getElementById('api-key-group'),
  urlLabel: document.getElementById('url-label'),
  urlHelp: document.getElementById('url-help'),
  modelHelp: document.getElementById('model-help'),
  providerHelp: document.getElementById('provider-help'),
  testConnection: document.getElementById('test-connection'),
  connectionStatus: document.getElementById('connection-status'),
  saveSettings: document.getElementById('save-settings'),
  saveStatus: document.getElementById('save-status'),
  versionInfo: document.getElementById('version-info')
};

// ── Per-provider independent settings ────────────────
// Each provider stores its own url, model, and apiKey independently.
// The key `provider` records the active selection.
const PROVIDER_CONFIG = {
  ollama: {
    urlKey: 'ollamaUrl',
    modelKey: 'ollamaModel',
    apiKeyKey: null, // Ollama doesn't need an API key
    defaults: { url: 'http://localhost:11434', model: 'translategemma:4b', apiKey: '' },
    ui: {
      urlLabel: 'Server URL',
      urlHelp: 'The URL where your Ollama server is running. Default: http://localhost:11434',
      modelHelp: 'The Ollama model to use for translation. Default: translategemma:4b',
      modelPlaceholder: 'translategemma:4b',
      providerHelp: 'Use a local Ollama server for private, offline translation.',
      showApiKey: false
    }
  },
  openai: {
    urlKey: 'openaiUrl',
    modelKey: 'openaiModel',
    apiKeyKey: 'openaiApiKey',
    defaults: { url: 'https://api.openai.com', model: 'gpt-4o-mini', apiKey: '' },
    ui: {
      urlLabel: 'API Base URL',
      urlHelp: 'The base URL of the OpenAI-compatible API. e.g. https://api.openai.com',
      modelHelp: 'The model to use for translation. e.g. gpt-4o-mini',
      modelPlaceholder: 'gpt-4o-mini',
      providerHelp: 'Use any OpenAI-compatible API (OpenAI, Azure, LM Studio, etc.).',
      showApiKey: true
    }
  }
};

// All storage keys (flattened for chrome.storage.local.get)
const ALL_KEYS = ['provider'];
for (const cfg of Object.values(PROVIDER_CONFIG)) {
  ALL_KEYS.push(cfg.urlKey, cfg.modelKey);
  if (cfg.apiKeyKey) ALL_KEYS.push(cfg.apiKeyKey);
}

/**
 * Get the active provider's stored values
 * @param {Object} stored - Raw chrome.storage.local.get result
 * @param {string} provider - 'ollama' or 'openai'
 * @returns {{ url: string, model: string, apiKey: string }}
 */
function getProviderValues(stored, provider) {
  const cfg = PROVIDER_CONFIG[provider];
  return {
    url: stored[cfg.urlKey] || cfg.defaults.url,
    model: stored[cfg.modelKey] || cfg.defaults.model,
    apiKey: cfg.apiKeyKey ? (stored[cfg.apiKeyKey] || '') : ''
  };
}

// ── Init ──────────────────────────────────────────────

async function init() {
  dbg('INIT', 'Options page initializing...');
  await loadSettings();
  loadVersionInfo();
  bindEventListeners();
  dbg('INIT', 'Options page initialized');
}

function loadVersionInfo() {
  try {
    const manifest = chrome.runtime.getManifest();
    const commitEl = document.querySelector('meta[name="build-commit"]');
    const timeEl = document.querySelector('meta[name="build-time"]');
    const commitId = commitEl?.content || 'unknown';
    const buildTime = timeEl?.content || '';
    const version = manifest.version || '?.?.?';
    const timeStr = buildTime ? ` — built ${new Date(buildTime).toLocaleString()}` : '';
    elements.versionInfo.textContent = `v${version} (${commitId})${timeStr}`;
  } catch (error) {
    elements.versionInfo.textContent = 'version unknown';
  }
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(ALL_KEYS);
    const provider = stored.provider || 'ollama';
    const values = getProviderValues(stored, provider);

    elements.provider.value = provider;
    elements.ollamaUrl.value = values.url;
    elements.modelName.value = values.model;
    elements.apiKey.value = values.apiKey;
    applyProviderUI(provider);

    dbg('LOAD', 'Provider:', provider, 'Values:', values);
  } catch (error) {
    dbgErr('LOAD', 'Failed to load settings:', error);
    elements.provider.value = 'ollama';
    elements.ollamaUrl.value = PROVIDER_CONFIG.ollama.defaults.url;
    elements.modelName.value = PROVIDER_CONFIG.ollama.defaults.model;
    applyProviderUI('ollama');
  }
}

// ── Provider UI ───────────────────────────────────────

function applyProviderUI(provider) {
  const ui = PROVIDER_CONFIG[provider].ui;
  elements.urlLabel.textContent = ui.urlLabel;
  elements.urlHelp.textContent = ui.urlHelp;
  elements.modelHelp.textContent = ui.modelHelp;
  elements.providerHelp.textContent = ui.providerHelp;
  elements.modelName.placeholder = ui.modelPlaceholder;

  if (ui.showApiKey) {
    elements.apiKeyGroup.classList.remove('hidden');
  } else {
    elements.apiKeyGroup.classList.add('hidden');
  }
}

// ── Event binding ─────────────────────────────────────

function bindEventListeners() {
  // Provider switch — load that provider's stored values into the form
  elements.provider.addEventListener('change', async () => {
    const newProvider = elements.provider.value;

    // Save current form values to the OLD provider's keys first
    const oldProvider = newProvider === 'ollama' ? 'openai' : 'ollama';
    const oldCfg = PROVIDER_CONFIG[oldProvider];
    const oldData = {};
    oldData[oldCfg.urlKey] = elements.ollamaUrl.value.trim();
    oldData[oldCfg.modelKey] = elements.modelName.value.trim();
    if (oldCfg.apiKeyKey) oldData[oldCfg.apiKeyKey] = elements.apiKey.value.trim();
    await chrome.storage.local.set(oldData);
    dbg('SWITCH', 'Saved old provider', oldProvider, 'values');

    // Load the NEW provider's stored values
    const stored = await chrome.storage.local.get(ALL_KEYS);
    const values = getProviderValues(stored, newProvider);

    elements.ollamaUrl.value = values.url;
    elements.modelName.value = values.model;
    elements.apiKey.value = values.apiKey;
    applyProviderUI(newProvider);

    dbg('SWITCH', 'Loaded new provider', newProvider, 'values:', values);
  });

  elements.testConnection.addEventListener('click', handleTestConnection);
  elements.saveSettings.addEventListener('click', handleSaveSettings);
  elements.ollamaUrl.addEventListener('blur', validateUrl);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSaveSettings();
    }
  });
}

// ── Validation ────────────────────────────────────────

function validateUrl() {
  const url = elements.ollamaUrl.value.trim();
  if (!url) { showConnectionStatus('URL is required', 'error'); return false; }
  try {
    new URL(url);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showConnectionStatus('URL must start with http:// or https://', 'error');
      return false;
    }
    elements.ollamaUrl.classList.remove('error');
    showConnectionStatus('');
    return true;
  } catch {
    showConnectionStatus('Please enter a valid URL', 'error');
    return false;
  }
}

// ── Test Connection ───────────────────────────────────

async function handleTestConnection() {
  if (!validateUrl()) return;

  const provider = elements.provider.value;
  dbg('TEST', 'Provider:', provider);

  elements.testConnection.disabled = true;
  elements.testConnection.textContent = 'Testing...';
  showConnectionStatus('Step 1/2: Connecting...', 'info');

  try {
    const connResponse = await Promise.race([
      chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]);
    dbg('TEST', 'Connection response:', connResponse);

    if (connResponse?.success) {
      const model = elements.modelName.value.trim() || PROVIDER_CONFIG[provider].defaults.model;
      showConnectionStatus(`Step 2/2: Testing model "${model}"...`, 'info');

      const tlResponse = await Promise.race([
        chrome.runtime.sendMessage({ type: 'TEST_TRANSLATION' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Translation timeout')), 60000))
      ]);
      dbg('TEST', 'Translation response:', tlResponse);

      if (tlResponse?.success) {
        showConnectionStatus(
          `✓ Connected! "${tlResponse.model}" → "${tlResponse.translation}" (${tlResponse.duration})`,
          'success'
        );
      } else {
        showConnectionStatus(
          `✓ Connected, but model test failed: ${tlResponse?.message || 'unknown error'}`,
          'error'
        );
      }
    } else {
      showConnectionStatus(`✗ ${connResponse?.message || 'Failed to connect'}`, 'error');
    }
  } catch (error) {
    dbgErr('TEST', 'Test error:', error.message);
    showConnectionStatus(`✗ ${error.message}`, 'error');
  } finally {
    elements.testConnection.disabled = false;
    elements.testConnection.textContent = 'Test Connection';
  }
}

// ── Save ──────────────────────────────────────────────

async function handleSaveSettings() {
  if (!validateUrl()) return;

  const provider = elements.provider.value;
  const cfg = PROVIDER_CONFIG[provider];

  const data = {
    provider,
    [cfg.urlKey]: elements.ollamaUrl.value.trim(),
    [cfg.modelKey]: elements.modelName.value.trim() || cfg.defaults.model,
  };
  if (cfg.apiKeyKey) {
    data[cfg.apiKeyKey] = elements.apiKey.value.trim();
  }

  dbg('SAVE', 'Saving:', { provider, keys: Object.keys(data) });

  elements.saveSettings.disabled = true;
  elements.saveSettings.textContent = 'Saving...';

  try {
    await chrome.storage.local.set(data);
    dbg('SAVE', 'Settings saved');
    showSaveStatus('✓ Settings saved successfully', 'success');
  } catch (error) {
    dbgErr('SAVE', 'Failed:', error);
    showSaveStatus(`✗ Failed to save: ${error.message}`, 'error');
  } finally {
    elements.saveSettings.disabled = false;
    elements.saveSettings.textContent = 'Save Settings';
  }
}

// ── Status helpers ────────────────────────────────────

function showConnectionStatus(message, type = '') {
  elements.connectionStatus.textContent = message;
  elements.connectionStatus.className = 'connection-status';
  if (type) elements.connectionStatus.classList.add(type);
}

function showSaveStatus(message, type = '') {
  elements.saveStatus.textContent = message;
  elements.saveStatus.className = 'save-status';
  if (type) elements.saveStatus.classList.add(type);
  setTimeout(() => {
    elements.saveStatus.textContent = '';
    elements.saveStatus.className = 'save-status';
  }, 5000);
}

// ── Bootstrap ─────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
