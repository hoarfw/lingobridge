#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const CONFIG = {
  name: 'lingobridge-extension',
  version: '1.0.0',
  sourceDir: path.dirname(new URL(import.meta.url).pathname),
  outputDir: null,
  outputFile: null,
  commitId: null
};

// Get short commit hash
try {
  const { execSync } = await import('child_process', { assert: { type: 'object' } });
  CONFIG.commitId = execSync('git rev-parse --short HEAD', { cwd: CONFIG.sourceDir }).toString().trim();
} catch {
  CONFIG.commitId = 'unknown';
}

CONFIG.outputDir = path.join(CONFIG.sourceDir, 'dist');
CONFIG.outputFile = path.join(CONFIG.sourceDir, `${CONFIG.name}-${CONFIG.version}.crx`);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function cleanOutput() {
  log('\n🧹 Cleaning output directory...');

  if (fs.existsSync(CONFIG.outputDir)) {
    fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
  }

  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  logSuccess('Output directory cleaned');
}

function copyFiles() {
  log('\n📦 Copying files...');

  let copiedCount = 0;
  let skippedCount = 0;
  const visitedDirs = new Set();

  function copyRecursive(source, target) {
    const sourceKey = fs.realpathSync(source);
    if (visitedDirs.has(sourceKey)) {
      return;
    }
    visitedDirs.add(sourceKey);

    const items = fs.readdirSync(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);

      try {
        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
          if (item === 'node_modules' || item === '__tests__' || item === '__mocks__' || item === 'dist') {
            skippedCount++;
            continue;
          }

          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }
          copyRecursive(sourcePath, targetPath);
        } else if (stat.isFile()) {
          if (item.includes('.test.') || item.includes('.spec.') || item === 'package-lock.json') {
            skippedCount++;
            continue;
          }

          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
        }
      } catch (error) {
        logError(`Failed to copy ${item}: ${error.message}`);
      }
    }
  }

  copyRecursive(CONFIG.sourceDir, CONFIG.outputDir);
  logSuccess(`Copied ${copiedCount} files (skipped ${skippedCount} test/other files)`);
}

/**
 * Simple ES-module → IIFE bundler for content scripts.
 * Chrome MV3 content_scripts don't support "type": "module",
 * so we inline all imports into a single file wrapped in an IIFE.
 */
function bundleContentScripts() {
  log('\n🔗 Bundling content scripts for MV3 compatibility...');

  const entryFile = path.join(CONFIG.outputDir, 'src', 'content.js');
  const visited = new Set();

  function resolveImportPath(fromFile, importPath) {
    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, importPath);
    // Add .js if missing
    if (!resolved.endsWith('.js') && !fs.existsSync(resolved)) {
      return resolved + '.js';
    }
    return resolved;
  }

  function inlineFile(filePath) {
    const realPath = fs.realpathSync(filePath);
    if (visited.has(realPath)) {
      return `/* [already inlined: ${path.basename(filePath)}] */`;
    }
    visited.add(realPath);

    let code = fs.readFileSync(realPath, 'utf8');

    // Replace all import declarations with inlined code
    code = code.replace(
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g,
      (match, importPath) => {
        const resolvedPath = resolveImportPath(filePath, importPath);
        if (!fs.existsSync(resolvedPath)) {
          logError(`  Cannot resolve import: ${importPath} from ${filePath}`);
          return `/* ERROR: cannot resolve ${importPath} */`;
        }
        return inlineFile(resolvedPath);
      }
    );

    // Remove all export declarations
    code = code.replace(/export\s+(default\s+)?/g, (match, def) => {
      if (def) return 'var __content_default = ';
      return '';
    });

    // Rename all const/let declarations to var to avoid redeclaration errors
    // in the flat IIFE scope (multiple modules may declare `DEBUG`, `ts`, etc.)
    code = code.replace(/^(\s*)const\s+/gm, '$1var ');
    code = code.replace(/^(\s*)let\s+/gm, '$1var ');

    return code;
  }

  // Bundle the entry file
  let bundled = inlineFile(entryFile);

  // Wrap in IIFE to avoid polluting global scope
  bundled = `(function() {\n'use strict';\n${bundled}\n})();`;

  // Write the bundled file
  fs.writeFileSync(entryFile, bundled, 'utf8');

  // Remove now-unused content/*.js files that were inlined
  const contentDir = path.join(CONFIG.outputDir, 'src', 'content');
  if (fs.existsSync(contentDir)) {
    for (const file of fs.readdirSync(contentDir)) {
      if (file.endsWith('.js') && !file.includes('.test.') && !file.includes('.spec.')) {
        fs.unlinkSync(path.join(contentDir, file));
      }
    }
    // Remove content dir if empty
    try { fs.rmdirSync(contentDir); } catch {}
  }

  // Remove now-unused utils files that were only needed by content scripts
  // (but only if they're not imported by background.js / ollama-client.js)
  const utilsDir = path.join(CONFIG.outputDir, 'src', 'utils');
  // Keep: state-manager.js (used by background), error-categories.js (used by ollama-client), retry.js (used by ollama-client)
  // Remove: user-messages.js (only used by content scripts)
  const userMessagesFile = path.join(utilsDir, 'user-messages.js');
  if (fs.existsSync(userMessagesFile)) {
    fs.unlinkSync(userMessagesFile);
  }

  logSuccess(`Bundled content.js (${(Buffer.byteLength(bundled) / 1024).toFixed(1)} KB)`);
}

function createPackage() {
  log('\n📦 Creating .crx package...');

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(CONFIG.outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const stats = fs.statSync(CONFIG.outputFile);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      logSuccess(`Package created: ${CONFIG.outputFile}`);
      log(`Size: ${sizeMB} MB`);
      resolve();
    });

    output.on('error', reject);
    archive.pipe(output);

    archive.directory(CONFIG.outputDir, false);
    archive.finalize();
  });
}

async function build() {
  log('\n' + '='.repeat(60));
  log('🏗 Building LingoBridge Chrome Extension');
  log('='.repeat(60));

  cleanOutput();
  copyFiles();
  bundleContentScripts();

  // Inject build info into options.html meta tags
  const buildTime = new Date().toISOString();
  const optionsHtmlPath = path.join(CONFIG.outputDir, 'src', 'options', 'options.html');
  if (fs.existsSync(optionsHtmlPath)) {
    let html = fs.readFileSync(optionsHtmlPath, 'utf8');
    html = html.replace('__BUILD_COMMIT__', CONFIG.commitId);
    html = html.replace('__BUILD_TIME__', buildTime);
    fs.writeFileSync(optionsHtmlPath, html, 'utf8');
  }
  logSuccess(`Version: ${CONFIG.version} (${CONFIG.commitId}) built ${buildTime}`);

  const skipTests = process.argv.includes('--skip-tests');

  if (!skipTests) {
    log('\n🧪 Running tests...');
    try {
      const { execSync } = await import('child_process', { assert: { type: 'object' } });

      execSync('npm test', {
        stdio: 'inherit',
        cwd: CONFIG.sourceDir
      });

      logSuccess('All tests passed!');
    } catch (error) {
      logError('Tests failed');
      log('Run `npm test` to see failures');
      process.exit(1);
    }
  } else {
    log('\n⏭ Tests skipped');
  }

  await createPackage();

  log('\n' + '='.repeat(60));
  logSuccess('Build completed successfully! 🎉');
  log('='.repeat(60));

  log('\n📋 Loading instructions:');
  log('1. Open Chrome and navigate to chrome://extensions/');
  log('2. Enable "Developer mode" in the top right corner');
  log('3. Click "Load unpacked" and select dist/ folder');
  log('4. Or install the .crx file directly');

  log('\n📋 Testing instructions:');
  log('1. Make sure Ollama is running:');
  log('   ollama serve');
  log('2. Enable CORS for Chrome extensions:');
  log('   OLLAMA_ORIGINS=chrome-extension://* ollama serve');
}

build().catch(error => {
  logError(`Build failed: ${error.message}`);
  process.exit(1);
});
