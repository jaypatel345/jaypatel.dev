// ============================================
// RXDB DATA LAYER
// ============================================

/**
 * RxDB-based contribution data model
 * Replaces localStorage with RxDB for better data management
 */

class ContributionRxDB {
  constructor() {
    this.db = null;
    this.collection = null;
    this.isInitialized = false;
    this.dataCache = {}; // Cache for synchronous access
  }

  /**
   * Initialize RxDB database and collection
   */
  async init() {
    if (this.isInitialized) return; // Already initialized
    
    try {
      // Create RxDB database
      this.db = await RxDB.create({
        name: 'contribution_db',
        adapter: 'localstorage',
        ignoreDuplicate: true
      });

      // Create collection schema
      const schema = {
        version: 0,
        primaryKey: 'date',
        type: 'object',
        properties: {
          date: {
            type: 'string',
            maxLength: 10 // YYYY-MM-DD format
          },
          count: {
            type: 'number',
            minimum: 0
          },
          level: {
            type: 'number',
            minimum: 0,
            maximum: 4
          },
          types: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          lastUpdated: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['date', 'count', 'level']
      };

      // Create collection
      this.collection = await this.db.collection({
        name: 'contributions',
        schema: schema
      });

      // Initialize data if empty
      await this.initializeData();

      // Populate cache for synchronous access
      await this.populateCache();

      this.isInitialized = true;
      console.log('RxDB initialized successfully');
    } catch (error) {
      console.error('RxDB initialization failed:', error);
      // Fallback to localStorage if RxDB fails
      console.log('Falling back to localStorage');
      throw error; // Re-throw to trigger fallback
    }
  }

  /**
   * Populate cache for synchronous access
   */
  async populateCache() {
    try {
      const docs = await this.collection.find().exec();
      this.dataCache = {};
      
      for (const doc of docs) {
        this.dataCache[doc.date] = {
          count: doc.count,
          level: doc.level,
          types: doc.types || [],
          lastUpdated: doc.lastUpdated
        };
      }
    } catch (error) {
      console.error('Error populating cache:', error);
    }
  }

  /**
   * Initialize contribution data structure
   * Syncs with current timeline (Oct 2025 to 2028)
   */
  async initializeData() {
    const startDate = new Date(2025, 9, 1); // Start from Oct 2025
    const endDate = new Date(2028, 11, 31); // End at 2028

    // Check if collection is empty
    const existingDocs = await this.collection.find().exec();
    
    if (existingDocs.length === 0) {
      // Generate empty contribution data for the date range
      const bulkDocs = [];
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateKey = this.formatDateKey(date);
        bulkDocs.push({
          date: dateKey,
          count: 0,
          level: 0,
          types: [],
          lastUpdated: null
        });
      }

      // Bulk insert for better performance
      await this.collection.bulkInsert(bulkDocs);
      console.log('Initialized contribution data from Oct 2025 to 2028');
    }
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
   * Get contribution data for a specific date (synchronous from cache)
   */
  getContribution(date) {
    const dateKey = this.formatDateKey(date);
    
    // Return from cache for synchronous access
    if (this.dataCache[dateKey]) {
      return this.dataCache[dateKey];
    }

    // Return default if not found
    return { count: 0, level: 0, types: [], lastUpdated: null };
  }

  /**
   * Get contribution data for a specific date (async from database)
   */
  async getContributionAsync(date) {
    const dateKey = this.formatDateKey(date);
    
    try {
      const doc = await this.collection.findOne(dateKey).exec();
      if (doc) {
        return {
          count: doc.count,
          level: doc.level,
          types: doc.types || [],
          lastUpdated: doc.lastUpdated
        };
      }
    } catch (error) {
      console.error('Error getting contribution:', error);
    }

    // Return default if not found or error
    return { count: 0, level: 0, types: [], lastUpdated: null };
  }

  /**
   * Toggle contribution for a specific date (owner only)
   */
  async toggleContribution(date) {
    const dateKey = this.formatDateKey(date);
    
    try {
      const doc = await this.collection.findOne(dateKey).exec();
      
      if (doc) {
        // Toggle between 0 and 1
        const newCount = doc.count === 0 ? 1 : 0;
        const newLevel = newCount === 1 ? 1 : 0;
        const newLastUpdated = newCount === 1 ? new Date().toISOString() : null;
        
        // Update database
        await doc.update({
          $set: {
            count: newCount,
            level: newLevel,
            lastUpdated: newLastUpdated,
            types: newCount === 1 ? [] : []
          }
        });

        // Update cache
        this.dataCache[dateKey] = {
          count: newCount,
          level: newLevel,
          types: [],
          lastUpdated: newLastUpdated
        };

        return {
          count: newCount,
          level: newLevel,
          types: [],
          lastUpdated: newLastUpdated
        };
      }
    } catch (error) {
      console.error('Error toggling contribution:', error);
    }

    return { count: 0, level: 0, types: [], lastUpdated: null };
  }

  /**
   * Get contribution data for a date range (for virtualization)
   */
  async getContributionsInRange(startDate, endDate) {
    const contributions = [];
    
    try {
      const query = this.collection.find({
        selector: {
          date: {
            $gte: this.formatDateKey(startDate),
            $lte: this.formatDateKey(endDate)
          }
        },
        sort: [{ date: 'asc' }]
      });

      const docs = await query.exec();
      
      for (const doc of docs) {
        contributions.push({
          date: this.parseDateKey(doc.date),
          count: doc.count,
          level: doc.level,
          types: doc.types || [],
          lastUpdated: doc.lastUpdated
        });
      }
    } catch (error) {
      console.error('Error getting contributions in range:', error);
    }

    return contributions;
  }

  /**
   * Calculate statistics (synchronous from cache)
   */
  getStatistics() {
    let totalActiveDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let lastUpdated = null;

    try {
      const sortedDates = Object.keys(this.dataCache).sort();
      
      // Calculate total active days and max streak
      for (const dateKey of sortedDates) {
        const entry = this.dataCache[dateKey];
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
        const entry = this.dataCache[sortedDates[i]];
        if (entry.count > 0) {
          currentStreak++;
        } else {
          break;
        }
      }
    } catch (error) {
      console.error('Error calculating statistics:', error);
    }

    return {
      totalActiveDays,
      currentStreak,
      maxStreak,
      lastUpdated
    };
  }

  /**
   * Extend data to include future dates (for infinite scroll)
   */
  async extendData(endDate) {
    try {
      const latestDoc = await this.collection.find()
        .sort([{ date: 'desc' }])
        .limit(1)
        .exec();

      const latestDate = latestDoc.length > 0 
        ? this.parseDateKey(latestDoc[0].date)
        : new Date();

      const bulkDocs = [];
      for (let date = new Date(latestDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateKey = this.formatDateKey(date);
        
        // Check if document already exists
        const existing = await this.collection.findOne(dateKey).exec();
        if (!existing) {
          bulkDocs.push({
            date: dateKey,
            count: 0,
            level: 0,
            types: [],
            lastUpdated: null
          });
        }
      }

      if (bulkDocs.length > 0) {
        await this.collection.bulkInsert(bulkDocs);
      }
    } catch (error) {
      console.error('Error extending data:', error);
    }
  }

  /**
   * Export data for backup
   */
  async exportData() {
    try {
      const docs = await this.collection.find().exec();
      const data = {};
      
      for (const doc of docs) {
        data[doc.date] = {
          count: doc.count,
          level: doc.level,
          types: doc.types || [],
          lastUpdated: doc.lastUpdated
        };
      }

      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  /**
   * Import data from backup
   */
  async importData(importedData) {
    if (importedData && importedData.data) {
      try {
        const bulkDocs = [];
        
        for (const dateKey in importedData.data) {
          const entry = importedData.data[dateKey];
          bulkDocs.push({
            date: dateKey,
            count: entry.count,
            level: entry.level,
            types: entry.types || [],
            lastUpdated: entry.lastUpdated
          });
        }

        // Clear existing data
        await this.collection.remove();

        // Import new data
        await this.collection.bulkInsert(bulkDocs);
        
        console.log('Data imported successfully');
      } catch (error) {
        console.error('Error importing data:', error);
      }
    }
  }

  /**
   * Migrate existing localStorage data to RxDB
   */
  async migrateFromLocalStorage() {
    const storageKey = 'contribution_data';
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        const bulkDocs = [];
        
        for (const dateKey in parsedData) {
          const entry = parsedData[dateKey];
          bulkDocs.push({
            date: dateKey,
            count: entry.count,
            level: entry.level,
            types: entry.types || [],
            lastUpdated: entry.lastUpdated
          });
        }

        if (bulkDocs.length > 0) {
          await this.collection.bulkInsert(bulkDocs);
          console.log('Migrated localStorage data to RxDB');
          
          // Clear old localStorage after successful migration
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error('Error migrating from localStorage:', error);
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContributionRxDB;
}