// ============================================
// CONTRIBUTION DATA MODEL - FIREBASE VERSION
// ============================================

/**
 * Contribution data model using Firebase Realtime Database
 * - Multi-year support with infinite scroll
 * - Owner-only editing capability
 * - Firebase persistence for all users
 * - Real-time data synchronization
 */

class ContributionData {
  constructor() {
    this.data = {};
    this.database = window.firebaseDatabase;
    this.dbRef = this.database.ref('contributions');
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize data from Firebase
   */
  async init() {
    try {
      const snapshot = await this.dbRef.once('value');
      const firebaseData = snapshot.val();
      
      if (firebaseData) {
        this.data = firebaseData;
      } else {
        // Initialize with empty data if Firebase is empty
        this.data = this.initializeData();
        await this.saveData();
      }
      
      this.initialized = true;
      console.log('Firebase data loaded successfully');
      
      // Set up real-time listener
      this.setupRealtimeListener();
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      // Fallback to local initialization
      this.data = this.initializeData();
      this.initialized = true;
    }
  }

  /**
   * Set up real-time listener for data changes
   */
  setupRealtimeListener() {
    this.dbRef.on('value', (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        this.data = firebaseData;
        console.log('Real-time data update received');
        // Dispatch event for UI update
        document.dispatchEvent(new CustomEvent('contributionDataUpdated'));
      }
    });
  }

  /**
   * Initialize contribution data structure
   * Uses date strings as keys for easy backend migration
   * Syncs with current timeline (Oct 2025 to 2028)
   */
  initializeData() {
    const startDate = new Date(2025, 9, 1); // Start from Oct 2025
    const endDate = new Date(2028, 11, 31); // End at 2028
    const data = {};

    // Generate empty contribution data for the date range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = this.formatDateKey(date);
      data[dateKey] = {
        count: 0,
        level: 0, // 0-4 for contribution levels (future use)
        types: [], // ['github', 'leetcode', 'projects', 'learning', 'opensource']
        lastUpdated: null
      };
    }

    return data;
  }

  /**
   * Format date as YYYY-MM-DD for consistent key generation
   */
  formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse date key to Date object
   */
  parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Save data to Firebase
   */
  async saveData() {
    if (!this.data) {
      console.error('Cannot save: this.data is null or undefined');
      return;
    }
    
    try {
      await this.dbRef.set(this.data);
      console.log('Data saved to Firebase successfully');
    } catch (error) {
      console.error('Firebase save failed:', error);
    }
  }

  /**
   * Get contribution data for a specific date
   */
  getContribution(date) {
    const dateKey = this.formatDateKey(date);
    return this.data[dateKey] || { count: 0, level: 0, types: [], lastUpdated: null };
  }

  /**
   * Toggle contribution for a specific date (owner only)
   */
  toggleContribution(date) {
    const dateKey = this.formatDateKey(date);
    
    if (!this.data[dateKey]) {
      this.data[dateKey] = { count: 0, level: 0, types: [], lastUpdated: null };
    }

    // Toggle between 0 and 1 (simple on/off for now)
    if (this.data[dateKey].count === 0) {
      this.data[dateKey].count = 1;
      this.data[dateKey].level = 1;
      this.data[dateKey].lastUpdated = new Date().toISOString();
    } else {
      this.data[dateKey].count = 0;
      this.data[dateKey].level = 0;
      this.data[dateKey].types = [];
      this.data[dateKey].lastUpdated = null;
    }

    // Don't auto-save - user must manually save
    return this.data[dateKey];
  }

  /**
   * Get contribution data for a date range (for virtualization)
   */
  getContributionsInRange(startDate, endDate) {
    const contributions = [];
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      contributions.push({
        date: new Date(date),
        ...this.getContribution(date)
      });
    }
    return contributions;
  }

  /**
   * Calculate statistics
   */
  getStatistics() {
    const today = new Date();
    let totalActiveDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let lastUpdated = null;

    // Sort dates and calculate streaks
    const sortedDates = Object.keys(this.data).sort();
    
    for (let i = 0; i < sortedDates.length; i++) {
      const entry = this.data[sortedDates[i]];
      if (entry.count > 0) {
        totalActiveDays++;
        tempStreak++;
        
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }

        // Track last updated
        if (entry.lastUpdated && (!lastUpdated || new Date(entry.lastUpdated) > new Date(lastUpdated))) {
          lastUpdated = entry.lastUpdated;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Calculate current streak (going backwards from today)
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const entry = this.data[sortedDates[i]];
      if (entry.count > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalActiveDays,
      currentStreak,
      maxStreak,
      lastUpdated
    };
  }

  /**
   * Get the last updated date
   */
  getLastUpdatedDate() {
    let lastUpdated = null;
    for (const dateKey in this.data) {
      const entry = this.data[dateKey];
      if (entry.lastUpdated) {
        if (!lastUpdated || new Date(entry.lastUpdated) > new Date(lastUpdated)) {
          lastUpdated = entry.lastUpdated;
        }
      }
    }
    return lastUpdated;
  }

  /**
   * Extend data to include future dates (for infinite scroll)
   */
  extendData(endDate) {
    const existingKeys = Object.keys(this.data);
    const latestDate = existingKeys.length > 0 
      ? new Date(Math.max(...existingKeys.map(key => new Date(key).getTime())))
      : new Date();

    for (let date = new Date(latestDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = this.formatDateKey(date);
      if (!this.data[dateKey]) {
        this.data[dateKey] = {
          count: 0,
          level: 0,
          types: [],
          lastUpdated: null
        };
      }
    }

    this.saveData();
  }

  /**
   * Export data for backup
   */
  exportData() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: this.data
    };
  }

  /**
   * Import data from backup
   */
  importData(importedData) {
    if (importedData && importedData.data) {
      this.data = importedData.data;
      this.saveData();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContributionData;
}