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
    
    // Wait for Firebase to be initialized
    if (typeof window.firebaseDatabase === 'undefined') {
      console.error('Firebase database not initialized. Waiting for initialization...');
      // Try to get it after a short delay
      setTimeout(() => {
        this.waitForFirebase();
      }, 100);
      return;
    }
    
    this.database = window.firebaseDatabase;
    this.dbRef = this.database.ref('contributions');
    this.initialized = false;
    this.init();
  }

  /**
   * Wait for Firebase to be initialized
   */
  waitForFirebase() {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof window.firebaseDatabase !== 'undefined') {
        clearInterval(checkInterval);
        this.database = window.firebaseDatabase;
        this.dbRef = this.database.ref('contributions');
        this.initialized = false;
        this.init();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('Firebase initialization timeout. Using localStorage fallback.');
        this.initLocalStorageFallback();
      }
    }, 200);
  }

  /**
   * Fallback to localStorage if Firebase fails
   */
  initLocalStorageFallback() {
    console.log('Using localStorage fallback for contribution data');
    
    // Try to load from localStorage
    const localData = localStorage.getItem('contributionData');
    if (localData) {
      try {
        this.data = JSON.parse(localData);
        console.log('Data loaded from localStorage');
      } catch (e) {
        console.error('Failed to parse localStorage data:', e);
        this.data = this.initializeData();
      }
    } else {
      this.data = this.initializeData();
    }
    
    this.initialized = true;
    this.useLocalStorage = true;
    
    // Override saveData to use localStorage
    this.saveData = async () => {
      localStorage.setItem('contributionData', JSON.stringify(this.data));
      console.log('Data saved to localStorage');
    };
  }

  /**
   * Initialize data from Firebase
   */
  async init() {
    try {
      const snapshot = await this.dbRef.once('value');
      const firebaseData = snapshot.val();
      
      if (firebaseData) {
        // Always preserve existing data regardless of date range
        this.data = firebaseData;
        console.log('Firebase data loaded successfully');
        console.log('Data keys loaded:', Object.keys(this.data).length);
      } else {
        // Initialize with empty data if Firebase is empty
        this.data = this.initializeData();

        // Seed historical sample data only on first-ever initialization —
        // calling this on every load re-inserts hardcoded months and
        // silently undoes any month the owner has deleted.
        this.addSampleData();

        await this.saveData();
        console.log('Firebase data initialized with new date range');
      }

      this.initialized = true;

      // Set up real-time listener
      this.setupRealtimeListener();
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  /**
   * Set up real-time listener for data changes
   */
  setupRealtimeListener() {
    this.dbRef.on('value', (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        // Skip the echo of our own just-completed write. Comparing key
        // counts here previously (treating "fewer keys" as stale) caused
        // month deletions to be silently reverted by this same listener.
        const incoming = JSON.stringify(firebaseData);
        if (incoming !== this._lastSavedSnapshot) {
          this.data = firebaseData;
          console.log('Real-time data update received');
          // Dispatch event for UI update
          document.dispatchEvent(new CustomEvent('contributionDataUpdated'));
        } else {
          console.log('Real-time update ignored (echo of our own write)');
        }
      }
    });
  }

  /**
   * Initialize contribution data structure
   * Uses date strings as keys for easy backend migration
   * Syncs with current timeline (Oct 2025 to Aug 2026)
   * Level system: 0=no activity, 1=light green (2+ hours), 2=mid green (6+ hours), 3=dark green (10+ hours), 4=coding (light green coding boxes)
   */
  initializeData() {
    const startDate = new Date(2025, 9, 1); // Start from Oct 2025
    const endDate = new Date(2026, 7, 31); // End at Aug 2026
    const data = {};

    // Generate empty contribution data for the date range
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = this.formatDateKey(date);
      data[dateKey] = {
        level: 0, // 0-4: 0=none, 1=light green (2+ hrs), 2=mid green (6+ hrs), 3=dark green (10+ hrs), 4=coding (light green coding boxes)
        lastUpdated: null
      };
    }

    return data;
  }

  /**
   * Get the actual date range from existing data
   */
  getDateRange() {
    if (!this.data || typeof this.data !== 'object') {
      console.log('Data is empty or invalid, using default date range');
      return {
        startDate: new Date(2025, 9, 1),
        endDate: new Date(2026, 7, 31)
      };
    }

    const dateKeys = Object.keys(this.data);
    if (dateKeys.length === 0) {
      console.log('No date keys found, using default date range');
      return {
        startDate: new Date(2025, 9, 1),
        endDate: new Date(2026, 7, 31)
      };
    }

    const sortedKeys = dateKeys.sort();
    const startDate = this.parseDateKey(sortedKeys[0]);
    const endDate = this.parseDateKey(sortedKeys[sortedKeys.length - 1]);

    console.log('Date range from data:', startDate, 'to', endDate);
    console.log('Total date keys:', dateKeys.length);
    return { startDate, endDate };
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
      this._lastSavedSnapshot = JSON.stringify(this.data);
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
    return this.data[dateKey] || { level: 0, lastUpdated: null };
  }

  /**
   * Map an exact hour count to a contribution level (owner only)
   * 0h -> 0 (none), 1-5h -> 1 (light), 6-9h -> 2 (mid), 10h+ -> 3 (dark)
   */
  hoursToLevel(hours) {
    if (hours <= 0) return 0;
    if (hours < 6) return 1;
    if (hours < 10) return 2;
    return 3;
  }

  /**
   * Set the exact hours for a specific date (owner only)
   * Derives the color level from the hour count so the grid and the
   * hover tooltip always agree on the same number.
   */
  setContributionHours(date, hours) {
    const dateKey = this.formatDateKey(date);
    const numericHours = Math.max(0, Number(hours) || 0);

    this.data[dateKey] = {
      level: this.hoursToLevel(numericHours),
      hours: numericHours,
      lastUpdated: numericHours > 0 ? new Date().toISOString() : null
    };

    // Auto-save will be called by handleCellClick
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
      if (entry.level > 0) {
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
      if (entry.level > 0) {
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
          level: 0,
          lastUpdated: null
        };
      }
    }

    this.saveData();
  }

  /**
   * Auto-extend data by adding 1 more month when reaching the end
   */
  autoExtendData() {
    const existingKeys = Object.keys(this.data);
    if (existingKeys.length === 0) return;

    const latestDate = new Date(Math.max(...existingKeys.map(key => new Date(key).getTime())));
    console.log('Current latest date:', latestDate, '(', this.formatDateKey(latestDate), ')');
    
    // Calculate the next month to add
    const nextMonthYear = latestDate.getFullYear();
    const nextMonth = latestDate.getMonth() + 1; // Next month (0-indexed)
    
    console.log('Adding month:', nextMonth, 'of year:', nextMonthYear);
    
    // Calculate days in the next month
    const daysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
    console.log('Days in next month:', daysInNextMonth);
    
    // Add only the days for the next month
    for (let day = 1; day <= daysInNextMonth; day++) {
      const currentDate = new Date(nextMonthYear, nextMonth, day);
      const dateKey = this.formatDateKey(currentDate);
      if (!this.data[dateKey]) {
        this.data[dateKey] = {
          level: 0,
          lastUpdated: null
        };
        console.log('Added:', dateKey);
      } else {
        console.log('Date already exists:', dateKey);
      }
    }
    
    this.saveData();
    
    // Return the new end date (last day of the added month)
    const newEndDate = new Date(nextMonthYear, nextMonth, daysInNextMonth);
    console.log('New end date:', newEndDate, '(', this.formatDateKey(newEndDate), ')');
    return newEndDate;
  }

  /**
   * Set contribution level for a specific date
   */
  setContribution(date, level, hours = null) {
    const dateKey = this.formatDateKey(date);
    this.data[dateKey] = {
      level: level,
      hours: hours, // Store exact hours
      lastUpdated: new Date().toISOString()
    };
    this.saveData();
    console.log('Set contribution for', dateKey, 'to level', level, 'hours:', hours);
  }

  /**
   * Add sample contribution data
   */
  addSampleData() {
    // Contribution data from user's coding hours
    // Level conversion: 0=0h, 1=1-5h, 2=6-9h, 3=10+h
    const contributionData = [
      // October 2025
      { date: '2025-10-09', level: 1, hours: 2 }, { date: '2025-10-10', level: 1, hours: 2 }, { date: '2025-10-11', level: 1, hours: 2 },
      { date: '2025-10-12', level: 1, hours: 3 }, { date: '2025-10-13', level: 2, hours: 6 }, { date: '2025-10-14', level: 1, hours: 4 },
      { date: '2025-10-15', level: 2, hours: 7 }, { date: '2025-10-16', level: 2, hours: 6 }, { date: '2025-10-17', level: 2, hours: 7 },
      { date: '2025-10-18', level: 1, hours: 3 }, { date: '2025-10-19', level: 1, hours: 4 }, { date: '2025-10-20', level: 3, hours: 10 },
      { date: '2025-10-21', level: 1, hours: 1 }, { date: '2025-10-22', level: 1, hours: 2 }, { date: '2025-10-23', level: 1, hours: 4 },
      { date: '2025-10-24', level: 1, hours: 4 }, { date: '2025-10-25', level: 1, hours: 5 }, { date: '2025-10-26', level: 2, hours: 8 },
      { date: '2025-10-27', level: 1, hours: 5 }, { date: '2025-10-28', level: 2, hours: 6 }, { date: '2025-10-29', level: 1, hours: 4 },
      { date: '2025-10-30', level: 1, hours: 4 }, { date: '2025-10-31', level: 2, hours: 6 },
      // November 2025
      { date: '2025-11-01', level: 1, hours: 4 }, { date: '2025-11-02', level: 1, hours: 3 }, { date: '2025-11-03', level: 0, hours: 0 },
      { date: '2025-11-04', level: 0, hours: 0 }, { date: '2025-11-05', level: 0, hours: 0 }, { date: '2025-11-06', level: 1, hours: 1 },
      { date: '2025-11-07', level: 1, hours: 4 }, { date: '2025-11-08', level: 2, hours: 6 }, { date: '2025-11-09', level: 2, hours: 7 },
      { date: '2025-11-10', level: 1, hours: 4 }, { date: '2025-11-11', level: 2, hours: 7 }, { date: '2025-11-12', level: 2, hours: 7 },
      { date: '2025-11-13', level: 2, hours: 7 }, { date: '2025-11-14', level: 2, hours: 6 }, { date: '2025-11-15', level: 2, hours: 6 },
      { date: '2025-11-16', level: 2, hours: 6 }, { date: '2025-11-17', level: 3, hours: 12 }, { date: '2025-11-18', level: 0, hours: 0 },
      { date: '2025-11-19', level: 2, hours: 7 }, { date: '2025-11-20', level: 3, hours: 10 }, { date: '2025-11-21', level: 2, hours: 8 },
      { date: '2025-11-22', level: 2, hours: 7 }, { date: '2025-11-23', level: 0, hours: 0 }, { date: '2025-11-24', level: 0, hours: 0 },
      { date: '2025-11-25', level: 2, hours: 6 }, { date: '2025-11-26', level: 1, hours: 4 }, { date: '2025-11-27', level: 2, hours: 6 },
      { date: '2025-11-28', level: 2, hours: 9 }, { date: '2025-11-29', level: 1, hours: 5 }, { date: '2025-11-30', level: 1, hours: 4 },
      // December 2025
      { date: '2025-12-01', level: 1, hours: 2 }, { date: '2025-12-02', level: 0, hours: 0 }, { date: '2025-12-03', level: 0, hours: 0 },
      { date: '2025-12-04', level: 1, hours: 4 }, { date: '2025-12-05', level: 1, hours: 4 }, { date: '2025-12-06', level: 1, hours: 5 },
      { date: '2025-12-07', level: 0, hours: 0 }, { date: '2025-12-08', level: 0, hours: 0 }, { date: '2025-12-09', level: 1, hours: 5 },
      { date: '2025-12-10', level: 0, hours: 0 }, { date: '2025-12-11', level: 0, hours: 0 }, { date: '2025-12-12', level: 1, hours: 1 },
      { date: '2025-12-13', level: 1, hours: 5 }, { date: '2025-12-14', level: 1, hours: 4 }, { date: '2025-12-15', level: 0, hours: 0 },
      { date: '2025-12-16', level: 1, hours: 3 }, { date: '2025-12-17', level: 1, hours: 5 }, { date: '2025-12-18', level: 1, hours: 5 },
      { date: '2025-12-19', level: 0, hours: 0 }, { date: '2025-12-20', level: 1, hours: 2 }, { date: '2025-12-21', level: 0, hours: 0 },
      { date: '2025-12-22', level: 0, hours: 0 }, { date: '2025-12-23', level: 0, hours: 0 }, { date: '2025-12-24', level: 0, hours: 0 },
      { date: '2025-12-25', level: 0, hours: 0 }, { date: '2025-12-26', level: 0, hours: 0 }, { date: '2025-12-27', level: 0, hours: 0 },
      { date: '2025-12-28', level: 0, hours: 0 }, { date: '2025-12-29', level: 0, hours: 0 }, { date: '2025-12-30', level: 0, hours: 0 },
      { date: '2025-12-31', level: 0, hours: 0 },
      // January 2026
      { date: '2026-01-01', level: 0, hours: 0 }, { date: '2026-01-02', level: 0, hours: 0 }, { date: '2026-01-03', level: 0, hours: 0 },
      { date: '2026-01-04', level: 0, hours: 0 }, { date: '2026-01-05', level: 0, hours: 0 }, { date: '2026-01-06', level: 0, hours: 0 },
      { date: '2026-01-07', level: 1, hours: 4 }, { date: '2026-01-08', level: 1, hours: 5 }, { date: '2026-01-09', level: 1, hours: 5 },
      { date: '2026-01-10', level: 1, hours: 4 }, { date: '2026-01-11', level: 1, hours: 4 }, { date: '2026-01-12', level: 1, hours: 4 },
      { date: '2026-01-13', level: 1, hours: 5 }, { date: '2026-01-14', level: 0, hours: 0 }, { date: '2026-01-15', level: 1, hours: 5 },
      { date: '2026-01-16', level: 1, hours: 5 }, { date: '2026-01-17', level: 1, hours: 5 }, { date: '2026-01-18', level: 1, hours: 2 },
      { date: '2026-01-19', level: 1, hours: 2 }, { date: '2026-01-20', level: 1, hours: 2 }, { date: '2026-01-21', level: 1, hours: 2 },
      { date: '2026-01-22', level: 1, hours: 3 }, { date: '2026-01-23', level: 1, hours: 2 }, { date: '2026-01-24', level: 0, hours: 0 },
      { date: '2026-01-25', level: 0, hours: 0 }, { date: '2026-01-26', level: 0, hours: 0 }, { date: '2026-01-27', level: 1, hours: 2 },
      { date: '2026-01-28', level: 0, hours: 0 }, { date: '2026-01-29', level: 0, hours: 0 }, { date: '2026-01-30', level: 0, hours: 0 },
      { date: '2026-01-31', level: 0, hours: 0 },
      // February 2026
      { date: '2026-02-01', level: 1, hours: 5 }, { date: '2026-02-02', level: 1, hours: 5 }, { date: '2026-02-03', level: 1, hours: 5 },
      { date: '2026-02-04', level: 1, hours: 5 }, { date: '2026-02-05', level: 1, hours: 5 }, { date: '2026-02-06', level: 1, hours: 5 },
      { date: '2026-02-07', level: 1, hours: 5 }, { date: '2026-02-08', level: 2, hours: 6 }, { date: '2026-02-09', level: 2, hours: 6 },
      { date: '2026-02-10', level: 2, hours: 6 }, { date: '2026-02-11', level: 2, hours: 6 }, { date: '2026-02-12', level: 2, hours: 6 },
      { date: '2026-02-13', level: 2, hours: 6 }, { date: '2026-02-14', level: 2, hours: 6 }, { date: '2026-02-15', level: 1, hours: 4 },
      { date: '2026-02-16', level: 1, hours: 4 }, { date: '2026-02-17', level: 2, hours: 7 }, { date: '2026-02-18', level: 1, hours: 1 },
      { date: '2026-02-19', level: 1, hours: 1 }, { date: '2026-02-20', level: 1, hours: 4 }, { date: '2026-02-21', level: 1, hours: 1 },
      { date: '2026-02-22', level: 1, hours: 2 }, { date: '2026-02-23', level: 3, hours: 10 }, { date: '2026-02-24', level: 1, hours: 5 },
      { date: '2026-02-25', level: 1, hours: 5 }, { date: '2026-02-26', level: 1, hours: 5 }, { date: '2026-02-27', level: 1, hours: 4 },
      { date: '2026-02-28', level: 1, hours: 2 },
      // March 2026
      { date: '2026-03-01', level: 1, hours: 3 }, { date: '2026-03-02', level: 2, hours: 6 }, { date: '2026-03-03', level: 1, hours: 1 },
      { date: '2026-03-04', level: 0, hours: 0 }, { date: '2026-03-05', level: 1, hours: 5 }, { date: '2026-03-06', level: 1, hours: 5 },
      { date: '2026-03-07', level: 0, hours: 0 }, { date: '2026-03-08', level: 2, hours: 9 }, { date: '2026-03-09', level: 1, hours: 3 },
      { date: '2026-03-10', level: 2, hours: 6 }, { date: '2026-03-11', level: 1, hours: 3 }, { date: '2026-03-12', level: 2, hours: 6 },
      { date: '2026-03-13', level: 1, hours: 3 }, { date: '2026-03-14', level: 1, hours: 5 }, { date: '2026-03-15', level: 1, hours: 1 },
      { date: '2026-03-16', level: 1, hours: 2 }, { date: '2026-03-17', level: 2, hours: 6 }, { date: '2026-03-18', level: 1, hours: 2 },
      { date: '2026-03-19', level: 1, hours: 3 }, { date: '2026-03-20', level: 2, hours: 6 }, { date: '2026-03-21', level: 0, hours: 0 },
      { date: '2026-03-22', level: 0, hours: 0 }, { date: '2026-03-23', level: 2, hours: 7 }, { date: '2026-03-24', level: 1, hours: 5 },
      { date: '2026-03-25', level: 1, hours: 2 }, { date: '2026-03-26', level: 1, hours: 2 }, { date: '2026-03-27', level: 1, hours: 2 },
      { date: '2026-03-28', level: 1, hours: 1 }, { date: '2026-03-29', level: 1, hours: 5 }, { date: '2026-03-30', level: 1, hours: 4 },
      { date: '2026-03-31', level: 1, hours: 4 },
      // April 2026
      { date: '2026-04-01', level: 1, hours: 4 }, { date: '2026-04-02', level: 1, hours: 4 }, { date: '2026-04-03', level: 1, hours: 1 },
      { date: '2026-04-04', level: 1, hours: 5 }, { date: '2026-04-05', level: 1, hours: 2 }, { date: '2026-04-06', level: 0, hours: 0 },
      { date: '2026-04-07', level: 2, hours: 6 }, { date: '2026-04-08', level: 1, hours: 4 }, { date: '2026-04-09', level: 1, hours: 2 },
      { date: '2026-04-10', level: 1, hours: 4 }, { date: '2026-04-11', level: 1, hours: 4 }, { date: '2026-04-12', level: 1, hours: 3 },
      { date: '2026-04-13', level: 3, hours: 10 }, { date: '2026-04-14', level: 2, hours: 6 }, { date: '2026-04-15', level: 1, hours: 4 },
      { date: '2026-04-16', level: 2, hours: 6 }, { date: '2026-04-17', level: 2, hours: 6 }, { date: '2026-04-18', level: 0, hours: 0 },
      { date: '2026-04-19', level: 2, hours: 7 }, { date: '2026-04-20', level: 2, hours: 6 }, { date: '2026-04-21', level: 2, hours: 6 },
      { date: '2026-04-22', level: 1, hours: 5 }, { date: '2026-04-23', level: 2, hours: 6 }, { date: '2026-04-24', level: 2, hours: 6 },
      { date: '2026-04-25', level: 2, hours: 8 }, { date: '2026-04-26', level: 1, hours: 3 }, { date: '2026-04-27', level: 1, hours: 4 },
      { date: '2026-04-28', level: 2, hours: 6 }, { date: '2026-04-29', level: 2, hours: 6 }, { date: '2026-04-30', level: 1, hours: 5 },
      // May 2026
      { date: '2026-05-01', level: 1, hours: 5 }, { date: '2026-05-02', level: 1, hours: 3 }, { date: '2026-05-03', level: 2, hours: 7 },
      { date: '2026-05-04', level: 0, hours: 0 }, { date: '2026-05-05', level: 2, hours: 7 }, { date: '2026-05-06', level: 1, hours: 4 },
      { date: '2026-05-07', level: 1, hours: 5 }, { date: '2026-05-08', level: 2, hours: 8 }, { date: '2026-05-09', level: 1, hours: 5 },
      { date: '2026-05-10', level: 0, hours: 0 }, { date: '2026-05-11', level: 0, hours: 0 }, { date: '2026-05-12', level: 0, hours: 0 },
      { date: '2026-05-13', level: 0, hours: 0 }, { date: '2026-05-14', level: 1, hours: 5 }, { date: '2026-05-15', level: 2, hours: 6 },
      { date: '2026-05-16', level: 1, hours: 3 }, { date: '2026-05-17', level: 1, hours: 4 }, { date: '2026-05-18', level: 1, hours: 3 },
      { date: '2026-05-19', level: 1, hours: 5 }, { date: '2026-05-20', level: 1, hours: 4 }, { date: '2026-05-21', level: 1, hours: 5 },
      { date: '2026-05-22', level: 1, hours: 2 }, { date: '2026-05-23', level: 1, hours: 5 }, { date: '2026-05-24', level: 2, hours: 7 },
      { date: '2026-05-25', level: 2, hours: 6 }, { date: '2026-05-26', level: 2, hours: 7 }, { date: '2026-05-27', level: 1, hours: 2 },
      { date: '2026-05-28', level: 1, hours: 5 }, { date: '2026-05-29', level: 1, hours: 3 }, { date: '2026-05-30', level: 1, hours: 3 },
      { date: '2026-05-31', level: 1, hours: 3 },
      // June 2026
      { date: '2026-06-01', level: 2, hours: 8 }, { date: '2026-06-02', level: 1, hours: 3 }, { date: '2026-06-03', level: 1, hours: 5 },
      { date: '2026-06-04', level: 1, hours: 4 }, { date: '2026-06-05', level: 2, hours: 7 }, { date: '2026-06-06', level: 1, hours: 3 },
      { date: '2026-06-07', level: 2, hours: 6 }, { date: '2026-06-08', level: 2, hours: 9 }, { date: '2026-06-09', level: 1, hours: 5 },
      { date: '2026-06-10', level: 1, hours: 5 }, { date: '2026-06-11', level: 1, hours: 4 }, { date: '2026-06-12', level: 2, hours: 8 },
      { date: '2026-06-13', level: 1, hours: 4 }, { date: '2026-06-14', level: 2, hours: 8 }, { date: '2026-06-15', level: 1, hours: 3 },
      { date: '2026-06-16', level: 2, hours: 8 }, { date: '2026-06-17', level: 1, hours: 4 }, { date: '2026-06-18', level: 2, hours: 8 },
      { date: '2026-06-19', level: 2, hours: 8 }, { date: '2026-06-20', level: 2, hours: 8 }, { date: '2026-06-21', level: 1, hours: 2 },
      { date: '2026-06-22', level: 2, hours: 7 }, { date: '2026-06-23', level: 2, hours: 6 }, { date: '2026-06-24', level: 2, hours: 7 },
      { date: '2026-06-25', level: 2, hours: 9 }, { date: '2026-06-26', level: 2, hours: 6 }, { date: '2026-06-27', level: 2, hours: 7 },
      { date: '2026-06-28', level: 2, hours: 8 }, { date: '2026-06-29', level: 1, hours: 5 }, { date: '2026-06-30', level: 2, hours: 8 },
      // July 2026
      { date: '2026-07-01', level: 1, hours: 3 }, { date: '2026-07-02', level: 3, hours: 10 }, { date: '2026-07-03', level: 2, hours: 7 },
      { date: '2026-07-04', level: 3, hours: 10 }, { date: '2026-07-05', level: 2, hours: 8 }, { date: '2026-07-06', level: 2, hours: 7 },
      { date: '2026-07-07', level: 2, hours: 7 }, { date: '2026-07-08', level: 1, hours: 4 }, { date: '2026-07-09', level: 2, hours: 6 },
      { date: '2026-07-10', level: 3, hours: 10 }, { date: '2026-07-11', level: 1, hours: 5 }, { date: '2026-07-12', level: 3, hours: 10 },
      { date: '2026-07-13', level: 2, hours: 7 }, { date: '2026-07-14', level: 3, hours: 10 }, { date: '2026-07-15', level: 2, hours: 9 },
      { date: '2026-07-16', level: 2, hours: 9 }, { date: '2026-07-17', level: 2, hours: 9 }, { date: '2026-07-18', level: 2, hours: 9 },
      { date: '2026-07-19', level: 1, hours: 2 }, { date: '2026-07-20', level: 1, hours: 2 }, { date: '2026-07-21', level: 1, hours: 2 },
      { date: '2026-07-22', level: 1, hours: 2 }, { date: '2026-07-23', level: 2, hours: 8 }, { date: '2026-07-24', level: 3, hours: 11 },
      { date: '2026-07-25', level: 2, hours: 7 }, { date: '2026-07-26', level: 2, hours: 9 }, { date: '2026-07-27', level: 2, hours: 8 },
      { date: '2026-07-28', level: 2, hours: 6 }, { date: '2026-07-29', level: 2, hours: 6 }, { date: '2026-07-30', level: 1, hours: 4 },
      { date: '2026-07-31', level: 1, hours: 2 },
      // August 2026
      { date: '2026-08-01', level: 2, hours: 9 }, { date: '2026-08-02', level: 1, hours: 5 }, { date: '2026-08-03', level: 1, hours: 5 },
      { date: '2026-08-04', level: 1, hours: 5 }, { date: '2026-08-05', level: 1, hours: 5 }, { date: '2026-08-06', level: 2, hours: 7 },
      { date: '2026-08-07', level: 2, hours: 8 }, { date: '2026-08-08', level: 1, hours: 3 }, { date: '2026-08-09', level: 1, hours: 3 },
      { date: '2026-08-10', level: 2, hours: 7 }, { date: '2026-08-11', level: 2, hours: 7 }, { date: '2026-08-12', level: 1, hours: 4 },
      { date: '2026-08-13', level: 2, hours: 7 }, { date: '2026-08-14', level: 2, hours: 6 }, { date: '2026-08-15', level: 2, hours: 8 },
      { date: '2026-08-16', level: 2, hours: 8 }, { date: '2026-08-17', level: 2, hours: 8 }, { date: '2026-08-18', level: 2, hours: 9 },
      { date: '2026-08-19', level: 1, hours: 5 }, { date: '2026-08-20', level: 2, hours: 7 }, { date: '2026-08-21', level: 2, hours: 6 },
      { date: '2026-08-22', level: 2, hours: 8 }, { date: '2026-08-23', level: 2, hours: 8 }, { date: '2026-08-24', level: 2, hours: 8 },
      { date: '2026-08-25', level: 3, hours: 10 }, { date: '2026-08-26', level: 2, hours: 8 }, { date: '2026-08-27', level: 2, hours: 6 },
      { date: '2026-08-28', level: 1, hours: 2 }, { date: '2026-08-29', level: 2, hours: 9 }, { date: '2026-08-30', level: 2, hours: 6 },
      { date: '2026-08-31', level: 2, hours: 9 },
      // September 2026
      { date: '2026-09-01', level: 2, hours: 6 }, { date: '2026-09-02', level: 2, hours: 7 }, { date: '2026-09-03', level: 2, hours: 7 },
      { date: '2026-09-04', level: 2, hours: 9 }, { date: '2026-09-05', level: 2, hours: 7 }, { date: '2026-09-06', level: 0, hours: 0 },
      { date: '2026-09-07', level: 0, hours: 0 }, { date: '2026-09-08', level: 0, hours: 0 }, { date: '2026-09-09', level: 0, hours: 0 },
      { date: '2026-09-10', level: 0, hours: 0 }, { date: '2026-09-11', level: 0, hours: 0 }, { date: '2026-09-12', level: 0, hours: 0 },
      { date: '2026-09-13', level: 0, hours: 0 }, { date: '2026-09-14', level: 0, hours: 0 }, { date: '2026-09-15', level: 0, hours: 0 },
      { date: '2026-09-16', level: 0, hours: 0 }, { date: '2026-09-17', level: 0, hours: 0 }, { date: '2026-09-18', level: 0, hours: 0 },
      { date: '2026-09-19', level: 0, hours: 0 }, { date: '2026-09-20', level: 0, hours: 0 }, { date: '2026-09-21', level: 0, hours: 0 },
      { date: '2026-09-22', level: 0, hours: 0 }, { date: '2026-09-23', level: 0, hours: 0 }, { date: '2026-09-24', level: 0, hours: 0 },
      { date: '2026-09-25', level: 0, hours: 0 }, { date: '2026-09-26', level: 0, hours: 0 }, { date: '2026-09-27', level: 0, hours: 0 },
      { date: '2026-09-28', level: 0, hours: 0 }, { date: '2026-09-29', level: 0, hours: 0 }, { date: '2026-09-30', level: 0, hours: 0 },
      // October 2026
      { date: '2026-10-01', level: 0, hours: 0 }, { date: '2026-10-02', level: 0, hours: 0 }, { date: '2026-10-03', level: 0, hours: 0 },
      { date: '2026-10-04', level: 0, hours: 0 }, { date: '2026-10-05', level: 0, hours: 0 }, { date: '2026-10-06', level: 0, hours: 0 },
      { date: '2026-10-07', level: 0, hours: 0 }, { date: '2026-10-08', level: 0, hours: 0 }, { date: '2026-10-09', level: 0, hours: 0 },
      { date: '2026-10-10', level: 0, hours: 0 }
    ];

    // Add all contribution data
    contributionData.forEach(item => {
      const [year, month, day] = item.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      this.setContribution(date, item.level, item.hours);
    });

    console.log('Added', contributionData.length, 'contribution entries');
  }

  /**
   * Remove the last month from data
   */
  removeLastMonth() {
    const existingKeys = Object.keys(this.data);
    if (existingKeys.length === 0) {
      console.log('No data to remove');
      return;
    }

    const latestDate = new Date(Math.max(...existingKeys.map(key => new Date(key).getTime())));
    console.log('Latest date found:', latestDate, '(', this.formatDateKey(latestDate), ')');
    
    // Calculate the date to remove from (start of the last month)
    const removeFromDate = new Date(latestDate);
    removeFromDate.setDate(1); // Set to first day of the month
    
    console.log('Removing data from', removeFromDate, 'to', latestDate);
    console.log('Data keys before removal:', existingKeys.length);
    
    // List all dates that will be removed
    const datesToRemove = [];
    for (let date = new Date(removeFromDate); date <= latestDate; date.setDate(date.getDate() + 1)) {
      const dateKey = this.formatDateKey(date);
      datesToRemove.push(dateKey);
    }
    console.log('Dates to remove:', datesToRemove.slice(0, 5), '...', datesToRemove.length, 'total');
    
    // Remove all dates in the last month - NO RESTRICTIONS
    let removedCount = 0;
    for (let date = new Date(removeFromDate); date <= latestDate; date.setDate(date.getDate() + 1)) {
      const dateKey = this.formatDateKey(date);
      if (this.data[dateKey]) {
        console.log('Deleting:', dateKey);
        delete this.data[dateKey];
        removedCount++;
      } else {
        console.log('Date key not found in data:', dateKey);
      }
    }
    
    console.log('Removed', removedCount, 'days from data');
    console.log('Data keys after removal:', Object.keys(this.data).length);
    
    this.saveData();
    
    // Return the new end date (last day of the previous month)
    const newEndDate = new Date(removeFromDate);
    newEndDate.setDate(0); // Set to last day of previous month
    console.log('New end date:', newEndDate, '(', this.formatDateKey(newEndDate), ')');
    return newEndDate;
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