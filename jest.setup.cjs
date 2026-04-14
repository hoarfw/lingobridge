/**
 * Jest setup file for Chrome API mocks
 */

// Mock chrome.storage.local.global = {
  chrome: {
    storage: {
      local: {
        get: jest.fn((keys, callback) => {
          if (callback) callback({});
          return Promise.resolve({});
        }),
        set: jest.fn((items, callback) => {
          if (callback) callback();
          return Promise.resolve();
        }),
        remove: jest.fn((keys, callback) => {
          if (callback) callback();
          return Promise.resolve();
        }),
        clear: jest.fn((callback) => {
          if (callback) callback();
          return Promise.resolve();
        })
      }
    },
    runtime: {
      sendMessage: jest.fn((message, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      onInstalled: {
        addListener: jest.fn()
      },
      getManifest: jest.fn(() => ({
        version: '1.0.0'
      }))
    },
    contextMenus: {
      create: jest.fn((createProperties, callback) => {
        if (callback) callback();
      }),
      remove: jest.fn((menuItemId, callback) => {
        if (callback) callback();
      }),
      removeAll: jest.fn((callback) => {
        if (callback) callback();
      }),
      onClicked: {
        addListener: jest.fn()
      }
    },
    commands: {
      onCommand: {
        addListener: jest.fn()
      }
    },
    action: {
      onClicked: {
        addListener: jest.fn()
      },
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn()
    },
    tabs: {
      sendMessage: jest.fn((tabId, message, callback) => {
        if (callback) callback();
        return Promise.resolve();
      }),
      query: jest.fn((queryInfo, callback) => {
        if (callback) callback([]);
        return Promise.resolve([]);
      })
    },
    scripting: {
      executeScript: jest.fn((injectDetails, callback) => {
        if (callback) callback([{ result: null }]);
        return Promise.resolve();
      })
    },
    notifications: {
      create: jest.fn((notificationId, options, callback) => {
        if (callback) callback('');
        return Promise.resolve('');
      }),
      clear: jest.fn((notificationId, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  }
};

// Mock IndexedDB for testing
const mockDB = {
  objectStoreNames: ['translations', 'metadata'],
  version: 1,
  transaction: jest.fn((storeNames, mode) => ({
    objectStore: jest.fn((storeName) => ({
      add: jest.fn((value, key) => ({
        result: 1,
        onsuccess: null,
        onerror: null
      })),
      put: jest.fn((value, key) => ({
        onsuccess: null,
        onerror: null
      })),
      get: jest.fn((key) => ({
        result: null,
        onsuccess: null,
        onerror: null
      })),
      getAll: jest.fn(() => ({
        result: [],
        onsuccess: null,
        onerror: null
      })),
      delete: jest.fn((key) => ({
        onsuccess: null,
        onerror: null
      })),
      count: jest.fn(() => ({
        result: 0,
        onsuccess: null,
        onerror: null
      })),
      clear: jest.fn(() => ({
        onsuccess: null,
        onerror: null
      })),
      index: jest.fn((name, keyPath, options) => ({
        openCursor: jest.fn((range, direction) => ({
          onsuccess: null,
          onerror: null
        }))
      }))
    }))
  }))
};

global.indexedDB = {
  open: jest.fn((name, version) => {
    const request = {
      result: mockDB,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    // Simulate immediate success
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  }),
  deleteDatabase: jest.fn()
};

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ response: 'Mock translation' })
  })
);

// Silence console.log in tests unless debug is enabled
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}
