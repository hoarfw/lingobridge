import { OllamaClient } from './services/ollama-client.js';
import { OpenAIClient } from './services/openai-client.js';
import { StateManager } from './utils/state-manager.js';

// ── Debug log helper ──────────────────────────────────
const DEBUG = true;

function dbg(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`%c[TG-BG ${ts}] [${tag}]`, 'color:#0f0;font-weight:bold', ...args);
}

function dbgErr(tag, ...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().substr(11, 12);
  console.error(`%c[TG-BG ${ts}] [${tag}]`, 'color:#f55;font-weight:bold', ...args);
}

// Per-provider storage keys (mirrors options.js PROVIDER_CONFIG)
const STORAGE_KEYS = {
  ollama:  { url: 'ollamaUrl',  model: 'ollamaModel',  apiKey: null },
  openai:  { url: 'openaiUrl',  model: 'openaiModel',  apiKey: 'openaiApiKey' }
};

const DEFAULTS = {
  ollama: { url: 'http://localhost:11434', model: 'translategemma:4b', apiKey: '' },
  openai: { url: 'https://api.openai.com', model: 'gpt-4o-mini', apiKey: '' }
};

// All keys for storage.get
const ALL_KEYS = ['provider'];
for (const cfg of Object.values(STORAGE_KEYS)) {
  ALL_KEYS.push(cfg.url, cfg.model);
  if (cfg.apiKey) ALL_KEYS.push(cfg.apiKey);
}

// Message types
const MESSAGE_TYPES = {
  TRANSLATE: 'TRANSLATE',
  TEST_CONNECTION: 'TEST_CONNECTION',
  TEST_TRANSLATION: 'TEST_TRANSLATION',
  GET_SELECTED_TEXT: 'GET_SELECTED_TEXT',
  TRIGGER_TRANSLATION: 'TRIGGER_TRANSLATION'
};

function isMissingReceiverError(error) {
  const message = error?.message || '';
  return (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection')
  );
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    dbg('INJECT', 'Content script missing, injecting into tab:', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js']
    });

    return await chrome.tabs.sendMessage(tabId, message);
  }
}

/**
 * Create the appropriate client based on stored provider setting
 */
function createClient(settings) {
  const provider = settings.provider || 'ollama';
  const keys = STORAGE_KEYS[provider];
  const defaults = DEFAULTS[provider];

  const url = settings[keys.url] || defaults.url;
  const model = settings[keys.model] || defaults.model;
  const apiKey = keys.apiKey ? (settings[keys.apiKey] || '') : '';

  if (provider === 'openai') {
    dbg('FACTORY', 'OpenAIClient:', url, model);
    return new OpenAIClient({ url, model, apiKey });
  }

  dbg('FACTORY', 'OllamaClient:', url, model);
  return new OllamaClient({ url, model });
}

/**
 * Load all settings from storage
 */
async function loadAllSettings() {
  return await StateManager.get(ALL_KEYS);
}

// ── Lifecycle ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  dbg('INSTALL', 'Reason:', details.reason);

  if (details.reason === 'install') {
    await StateManager.set({
      provider: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'translategemma:4b',
      openaiUrl: 'https://api.openai.com',
      openaiModel: 'gpt-4o-mini',
      openaiApiKey: ''
    });
    dbg('INSTALL', 'Default settings initialized');
  }

  registerContextMenu();
});

function registerContextMenu() {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate with TranslateGemma',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) console.log('Context menu already exists');
  });
}

// ── Triggers ──────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  dbg('CTX', 'Clicked:', info.menuItemId, 'text:', info.selectionText?.substring(0, 80));
  if (info.menuItemId === 'translate-selection' && info.selectionText && tab?.id) {
    try {
      const selection = await sendMessageToTab(tab.id, { type: MESSAGE_TYPES.GET_SELECTED_TEXT });
      const text = selection?.text || info.selectionText;
      await triggerTranslation(tab.id, text, selection?.elementInfo || null);
    } catch (error) {
      dbgErr('CTX', 'Failed to resolve selection context:', error.message);
      await triggerTranslation(tab.id, info.selectionText);
    }
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  dbg('CMD', 'Command:', command, 'tab:', tab?.id);
  if (command === 'translate-selection' && tab?.id) {
    try {
      const response = await sendMessageToTab(tab.id, { type: MESSAGE_TYPES.GET_SELECTED_TEXT });
      if (response?.text) await triggerTranslation(tab.id, response.text, response.elementInfo);
    } catch (error) { dbgErr('CMD', 'Failed:', error); }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  dbg('ACTION', 'Toolbar clicked, tab:', tab?.id);
  if (tab?.id) {
    try {
      const response = await sendMessageToTab(tab.id, { type: MESSAGE_TYPES.GET_SELECTED_TEXT });
      if (response?.text) await triggerTranslation(tab.id, response.text, response.elementInfo);
    } catch (error) { dbgErr('ACTION', 'Failed:', error); }
  }
});

async function triggerTranslation(tabId, text, elementInfo = null) {
  dbg('TRIGGER', 'Tab:', tabId, 'text:', text.substring(0, 100));
  try {
    const response = await sendMessageToTab(tabId, { type: MESSAGE_TYPES.TRIGGER_TRANSLATION, text, elementInfo });
    dbg('TRIGGER', 'Response:', response);
  } catch (error) { dbgErr('TRIGGER', 'Failed:', error.message); }
}

// ── Message handler ───────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dbg('MSG', 'Received:', message.type, 'from:', sender.tab?.url || 'extension');

  const handleAsync = async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.TRANSLATE:       return await handleTranslate(message);
        case MESSAGE_TYPES.TEST_CONNECTION: return await handleTestConnection();
        case MESSAGE_TYPES.TEST_TRANSLATION: return await handleTestTranslation();
        default:
          dbgErr('MSG', 'Unknown type:', message.type);
          return { error: 'Unknown message type' };
      }
    } catch (error) {
      dbgErr('MSG', 'Handler error:', error);
      return { success: false, message: error.message };
    }
  };

  handleAsync().then(r => {
    dbg('MSG', 'Response for', message.type, ':', r);
    sendResponse(r);
  }).catch(e => {
    dbgErr('MSG', 'Fatal:', e);
    sendResponse({ success: false, message: e.message });
  });

  return true;
});

// ── Handlers ──────────────────────────────────────────

async function handleTranslate(message) {
  dbg('TRANSLATE', 'Text:', message.text?.substring(0, 80));

  const settings = await loadAllSettings();
  dbg('TRANSLATE', 'Provider:', settings.provider);

  const client = createClient(settings);
  const result = await client.generate(message.text);
  dbg('TRANSLATE', 'Result:', result?.substring(0, 80));

  return { success: true, translation: result };
}

async function handleTestConnection() {
  dbg('TEST', 'Handling TEST_CONNECTION');

  const settings = await loadAllSettings();
  const client = createClient(settings);

  dbg('TEST', 'Testing connection, provider:', settings.provider);
  const isConnected = await client.testConnection();
  dbg('TEST', 'Result:', isConnected);

  return {
    success: isConnected,
    message: isConnected ? 'Connected successfully' : 'Failed to connect'
  };
}

async function handleTestTranslation() {
  dbg('TEST-TL', 'Handling TEST_TRANSLATION');

  const settings = await loadAllSettings();
  const client = createClient(settings);

  try {
    dbg('TEST-TL', 'Model:', client.model);
    const startTime = Date.now();
    const result = await client.generate('how are you?');
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    dbg('TEST-TL', 'Result:', result, 'in', duration, 's');

    if (result && result.trim()) {
      return { success: true, translation: result.trim(), duration: duration + 's', model: client.model };
    }
    return { success: false, message: `Model "${client.model}" returned empty response` };
  } catch (error) {
    dbgErr('TEST-TL', 'Failed:', error.message);
    return { success: false, message: error.message };
  }
}

dbg('INIT', 'Background service worker initialized');
