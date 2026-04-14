# TranslateGemma Chrome Extension

A Chrome browser extension that provides real-time translation using Ollama's local translate-gemma model. Users can translate selected text or entire web pages, with translation results displayed alongside original text in a bilingual format. Designed for cost-conscious users who want to avoid external translation API fees while reading foreign language web content and work-related documents.

## Build

```bash
# Install dependencies (first time only)
npm install

# Build the extension
npm run build

# Skip tests during build
npm run build:skip-tests
```

## Installation

### Option 1: Load Unpacked (Recommended for Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `dist/` folder
4. Confirm permissions when prompted

### Option 2: Load from Folder

1. Copy all files from `dist/` to a folder on your computer
2. Follow Option 1 steps above
3. Select the folder instead of `dist/`

## Configuration

### Ollama Setup

Before using the extension, make sure Ollama is running with CORS enabled:

```bash
# Start Ollama with CORS enabled for Chrome extensions
OLLAMA_ORIGINS=chrome-extension://* ollama serve

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### Extension Settings

1. Click the TranslateGemma icon in the Chrome toolbar
2. Select "Options" or right-click the extension and choose "Options"
3. Configure your Ollama settings:
   - **Ollama URL** (default: `http://localhost:11434`)
   - **Model Name** (default: `translategemma:4b`)
4. Click "Test Connection" to verify Ollama is accessible

### Install the Translation Model

```bash
# Pull the translate-gemma model (if not already installed)
ollama pull translategemma:4b

# Or use a different model
ollama pull llama3.2
```

## Usage

### Translate Selected Text

1. Select text on any webpage
2. Right-click and choose "Translate with TranslateGemma"
3. Or use the keyboard shortcut: `Alt+Shift+T`
4. Or click the extension toolbar button
5. Translation will appear below the selected text with a green left border

### Translate Entire Page

1. Navigate to a webpage with paragraphs or articles
2. Open extension popup or options page
3. Click "Translate Page"
4. Each paragraph will be translated sequentially
5. Translations appear below each original paragraph

### View Translation History

1. Open extension popup or options page
2. Click "View History"
3. Browse your past translations with search and filter capabilities

## Features

- **Local Translation**: Uses Ollama's local models, no data sent to external services
- **Selected Text Translation**: Translate via right-click menu, keyboard shortcut, or toolbar button
- **Full Page Translation**: Translate entire pages paragraph-by-paragraph
- **Bilingual Display**: Shows translations alongside original text for easy comparison
- **History Storage**: Stores last 500 translations locally with search capabilities
- **SPA Support**: Handles dynamic content in React, Vue, Angular applications
- **CSP Bypass**: Uses Shadow DOM to work on CSP-strict sites like GitHub
- **Customizable**: Configure Ollama server URL, model name, and keyboard shortcuts

## Permissions

The extension requires the following permissions:

- `activeTab` - Access to the active tab for text selection
- `storage` - Save settings and translation history
- `contextMenus` - Add translation option to right-click menu
- `scripting` - Inject content scripts into pages
- `host_permissions` - Connect to local Ollama server (`http://localhost:11434`)

## Troubleshooting

### Ollama Connection Failed

1. Make sure Ollama is running: `ps aux | grep ollama`
2. Check CORS is enabled: `OLLAMA_ORIGINS=chrome-extension://* ollama serve`
3. Verify Ollama URL in extension options matches your server
4. Try "Test Connection" in extension settings

### Translation Doesn't Appear

1. Check browser console (F12) for errors
2. Ensure text is selected before translating
3. Verify Ollama model is downloaded: `ollama list`

### CSP Errors on Strict Sites

The extension uses Shadow DOM to bypass CSP restrictions. If you still see errors:

1. Open DevTools → Console
2. Look for CSP-related errors
3. The extension should work even on GitHub, Twitter, and other strict sites

### Model Not Found

1. Open Ollama settings in extension options
2. Verify model name matches what's installed: `ollama list`
3. Pull the model: `ollama pull <model-name>`

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Project Structure

```
translgemma-extension/
├── manifest.json          # Chrome extension manifest
├── icons/                # Extension icons (16, 32, 48, 128)
├── src/                  # Source code
│   ├── background.js      # Service worker entry point
│   ├── content.js        # Content script entry point
│   ├── background/       # Background scripts
│   │   ├── context-menu.js
│   │   ├── keyboard-shortcuts.js
│   │   ├── message-handlers.js
│   │   └── toolbar-button.js
│   ├── content/         # Content script modules
│   │   ├── paragraph-detector.js
│   │   ├── shadow-renderer.js
│   │   ├── translation-queue.js
│   │   ├── page-translator.js
│   │   ├── mutation-observer.js
│   │   ├── spa-handler.js
│   │   ├── progress-indicator.js
│   │   ├── translation-display.js
│   │   ├── error-display.js
│   │   └── ...
│   ├── services/         # Service modules
│   │   ├── ollama-client.js
│   │   └── history-storage.js
│   ├── utils/            # Utility modules
│   │   ├── state-manager.js
│   │   ├── retry.js
│   │   ├── error-categories.js
│   │   └── ...
│   ├── options/          # Options page
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   └── history/           # History page
│       ├── history.html
│       ├── history.js
│       └── history.css
├── dist/                 # Built files (for loading)
├── package.json          # Node.js dependencies
├── jest.config.cjs      # Jest configuration
├── jest.setup.cjs       # Jest setup with Chrome API mocks
└── build.js             # Build script
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## Disclaimer

This extension uses Ollama for translation. Make sure you comply with Ollama's license terms when using their models.
