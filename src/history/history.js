import HistoryStorage from '../services/history-storage.js';

class HistoryViewer {
  constructor() {
    this.storage = new HistoryStorage();
    this.entries = [];
    this.currentSearch = '';
    this.currentOffset = 0;
    this.pageSize = 20;
    this.isLoading = false;
    this.hasMore = true;

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.showLoading();

    try {
      await this.storage.init();
      await this.loadEntries();
      this.updateStats();
    } catch (error) {
      console.error('Failed to initialize history viewer:', error);
      this.showError('Failed to load history. Please try again.');
    }
  }

  cacheElements() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
      searchBtn: document.getElementById('search-btn'),
      clearSearchBtn: document.getElementById('clear-search-btn'),
      clearAllBtn: document.getElementById('clear-all-btn'),
      historyList: document.getElementById('history-list'),
      entryCount: document.getElementById('entry-count'),
      emptyState: document.getElementById('empty-state'),
      noResultsState: document.getElementById('no-results-state'),
      loadingState: document.getElementById('loading-state')
    };
  }

  bindEvents() {
    // Search
    this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
    this.elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });

    // Clear search
    this.elements.clearSearchBtn.addEventListener('click', () => this.clearSearch());

    // Clear all
    this.elements.clearAllBtn.addEventListener('click', () => this.handleClearAll());

    // Infinite scroll
    this.elements.historyList.addEventListener('scroll', () => this.handleScroll());
  }

  async loadEntries(reset = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const options = {
        limit: this.pageSize,
        offset: reset ? 0 : this.currentOffset,
        search: this.currentSearch || null,
        order: 'desc'
      };

      const newEntries = await this.storage.getEntries(options);

      if (reset) {
        this.entries = newEntries;
        this.currentOffset = newEntries.length;
        this.elements.historyList.innerHTML = '';
      } else {
        this.entries.push(...newEntries);
        this.currentOffset += newEntries.length;
      }

      this.hasMore = newEntries.length === this.pageSize;
      this.renderEntries(newEntries, !reset);

      this.updateEmptyState();
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  renderEntries(entries, append = false) {
    if (!append) {
      this.elements.historyList.innerHTML = '';
    }

    entries.forEach(entry => {
      const itemEl = this.createHistoryItem(entry);
      this.elements.historyList.appendChild(itemEl);
    });
  }

  createHistoryItem(entry) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.dataset.id = entry.id;

    const date = new Date(entry.timestamp).toLocaleString();
    const domain = this.extractDomain(entry.url);

    div.innerHTML = `
      <div class="history-item-header">
        <span class="history-timestamp">${date}</span>
        <span class="history-url" title="${entry.url}">${domain}</span>
      </div>

      <div class="history-text-section">
        <div class="history-label">Original</div>
        <div class="history-original">${this.escapeHtml(this.truncate(entry.originalText, 200))}</div>
      </div>

      <div class="history-text-section">
        <div class="history-label">Translation</div>
        <div class="history-translated">${this.escapeHtml(this.truncate(entry.translatedText, 200))}</div>
      </div>

      <div class="history-item-actions">
        <button class="history-action-btn copy-btn" data-id="${entry.id}">
          Copy Translation
        </button>
        <button class="history-action-btn delete" data-id="${entry.id}">
          Delete
        </button>
      </div>
    `;

    // Bind events
    div.querySelector('.copy-btn').addEventListener('click', () => {
      this.copyTranslation(entry.translatedText);
    });

    div.querySelector('.delete').addEventListener('click', () => {
      this.deleteEntry(entry.id, div);
    });

    return div;
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async copyTranslation(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Translation copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Failed to copy', 'error');
    }
  }

  async deleteEntry(id, element) {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      await this.storage.deleteEntry(id);
      element.remove();
      this.entries = this.entries.filter(e => e.id !== id);
      this.updateStats();
      this.updateEmptyState();
      this.showToast('Entry deleted');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      this.showToast('Failed to delete', 'error');
    }
  }

  async handleClearAll() {
    if (!confirm('Are you sure you want to clear ALL translation history? This cannot be undone.')) {
      return;
    }

    try {
      await this.storage.clearAll();
      this.entries = [];
      this.elements.historyList.innerHTML = '';
      this.updateStats();
      this.updateEmptyState();
      this.showToast('All history cleared');
    } catch (error) {
      console.error('Failed to clear history:', error);
      this.showToast('Failed to clear history', 'error');
    }
  }

  updateStats() {
    const count = this.entries.length;
    this.elements.entryCount.textContent = `${count} entr${count === 1 ? 'y' : 'ies'}`;
  }

  updateEmptyState() {
    const hasEntries = this.entries.length > 0;
    const isSearching = this.currentSearch.length > 0;

    this.elements.emptyState.style.display = (!hasEntries && !isSearching) ? 'block' : 'none';
    this.elements.noResultsState.style.display = (!hasEntries && isSearching) ? 'block' : 'none';
    this.elements.historyList.style.display = hasEntries ? 'block' : 'none';
  }

  showLoading() {
    this.elements.loadingState.style.display = 'block';
    this.elements.historyList.style.display = 'none';
    this.elements.emptyState.style.display = 'none';
    this.elements.noResultsState.style.display = 'none';
  }

  hideLoading() {
    this.elements.loadingState.style.display = 'none';
  }

  showToast(message, type = 'success') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#4CAF50' : '#dc3545'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize
new HistoryViewer();
