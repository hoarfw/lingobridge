/**
 * StorageRotation - Manages rotation policy for translation history
 *
 * Automatically removes oldest entries when storage approaches capacity
 * to prevent quota exhaustion and maintain performance.
 */

/**
 * StorageRotation class for managing history rotation
 */
export class StorageRotation {
  /**
   * Create a new StorageRotation instance
   * @param {HistoryStorage} historyStorage - HistoryStorage instance
   * @param {Object} options - Rotation configuration
   * @param {number} options.maxEntries - Maximum entries to keep (default: 500)
   * @param {number} options.rotationTrigger - Trigger rotation at this capacity (default: 0.9)
   * @param {number} options.entriesToDelete - Number of oldest entries to delete (default: 50)
   */
  constructor(historyStorage, options = {}) {
    this.storage = historyStorage;
    this.maxEntries = options.maxEntries || 500;
    this.rotationTrigger = options.rotationTrigger || 0.9; // Rotate at 90% capacity
    this.entriesToDelete = options.entriesToDelete || 50; // Delete 50 oldest
  }

  /**
   * Check if rotation is needed and perform it
   * @returns {Promise<Object>} - Rotation result
   */
  async checkAndRotate() {
    try {
      const count = await this.storage.getCount();

      // Check if we need rotation
      if (count < this.maxEntries * this.rotationTrigger) {
        return { rotated: false, count, reason: 'under_threshold' };
      }

      console.log(`Storage rotation triggered: ${count}/${this.maxEntries} entries`);

      // Get oldest entries to delete
      const entriesToDelete = await this.getOldestEntries(
        Math.min(this.entriesToDelete, count - (this.maxEntries * 0.8))
      );

      // Delete entries
      let deleted = 0;
      for (const entry of entriesToDelete) {
        try {
          await this.storage.deleteEntry(entry.id);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete entry ${entry.id}:`, error);
        }
      }

      const newCount = await this.storage.getCount();
      console.log(`Rotation complete: deleted ${deleted} entries, ${newCount} remaining`);

      return {
        rotated: true,
        deleted,
        previousCount: count,
        newCount,
        entries: entriesToDelete.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          url: e.url
        }))
      };
    } catch (error) {
      console.error('Storage rotation failed:', error);
      return { rotated: false, error: error.message };
    }
  }

  /**
   * Get the oldest entries for deletion
   * @param {number} count - Number of entries to get
   * @returns {Promise<Array>} - Array of oldest entries
   */
  async getOldestEntries(count) {
    const entries = await this.storage.getEntries({
      limit: count,
      offset: 0,
      order: 'asc' // Oldest first
    });
    return entries;
  }

  /**
   * Force rotation to a target count
   * @param {number} targetCount - Target number of entries to keep
   * @returns {Promise<Object>} - Rotation result
   */
  async forceRotation(targetCount) {
    const currentCount = await this.storage.getCount();
    if (currentCount <= targetCount) {
      return { rotated: false, reason: 'already_below_target' };
    }

    const deleteCount = currentCount - targetCount;
    return this.getOldestEntries(deleteCount).then(async (entries) => {
      let deleted = 0;
      for (const entry of entries) {
        try {
          await this.storage.deleteEntry(entry.id);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete entry ${entry.id}:`, error);
        }
      }
      return {
        rotated: true,
        deleted,
        targetCount,
        previousCount: currentCount,
        newCount: currentCount - deleted
      };
    });
  }

  /**
   * Get rotation statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStats() {
    const count = await this.storage.getCount();
    return {
      currentEntries: count,
      maxEntries: this.maxEntries,
      utilization: count / this.maxEntries,
      shouldRotate: count >= (this.maxEntries * this.rotationTrigger)
    };
  }
}

export default StorageRotation;
