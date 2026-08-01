// ============================================
// CONTRIBUTION TRACKER MAIN COMPONENT
// ============================================

/**
 * Main contribution tracker that integrates all components
 * Handles edit mode toggle, owner authentication, and component coordination
 */

// Load ContributionCell class for its static method
// This is handled by script loading order in HTML

class ContributionTracker {
  constructor(options) {
    this.container = options.container;
    this.isOwner = options.isOwner || false; // Set to true only for you
    this.editModeEnabled = false;
    
    // Initialize with localStorage first for immediate display
    this.data = new ContributionData();
    
    // Initialize components immediately
    this.initComponents();
    this.initEditMode();
    this.render();
    
    // Then try to upgrade to RxDB asynchronously
    this.upgradeToRxDB();
  }

  /**
   * Upgrade to RxDB if available
   */
  async upgradeToRxDB() {
    try {
      if (typeof ContributionRxDB !== 'undefined') {
        const rxdbData = new ContributionRxDB();
        await rxdbData.init(); // Wait for RxDB initialization
        await rxdbData.migrateFromLocalStorage(); // Migrate existing data
        
        // Switch to RxDB data layer
        this.data = rxdbData;
        this.grid.data = rxdbData;
        this.grid.renderGrid(); // Re-render with new data
        
        console.log('Upgraded to RxDB data layer');
      }
    } catch (error) {
      console.error('RxDB upgrade failed, using localStorage:', error);
    }
  }

  /**
   * Initialize all sub-components
   */
  initComponents() {
    // Create grid container
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'contribution-grid-container';
    
    // Initialize grid with data
    this.grid = new ContributionGrid({
      data: this.data,
      isEditable: this.isOwner && this.editModeEnabled,
      onCellClick: this.handleCellClick.bind(this),
      container: this.gridContainer
    });
  }

  /**
   * Initialize edit mode functionality
   */
  initEditMode() {
    // Check if already authenticated from session
    if (isAuthenticated()) {
      this.isOwner = true;
    }

    // Create edit toggle button (always visible)
    this.editButton = document.createElement('button');
    this.editButton.className = 'edit-toggle-button';
    this.editButton.textContent = 'Edit Mode';
    this.editButton.style.cssText = `
      padding: 6px 12px;
      font-size: 11px;
      font-family: inherit;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 12px;
      transition: all 0.2s ease;
    `;
    
    this.editButton.addEventListener('click', () => {
      this.handleEditButtonClick();
    });
    
    // Add keyboard shortcut (E key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'e' && e.altKey) {
        this.handleEditButtonClick();
      }
    });
  }

  /**
   * Handle edit button click with authentication
   */
  handleEditButtonClick() {
    // Check if already authenticated
    if (isAuthenticated()) {
      this.toggleEditMode();
    } else {
      this.showAuthModal();
    }
  }

  /**
   * Show authentication modal
   */
  showAuthModal() {
    // Check if locked out
    if (isLockedOut()) {
      const remainingTime = getLockoutTimeRemaining();
      this.showLockoutMessage(remainingTime);
      return;
    }

    // Remove existing modal if any
    const existingModal = document.querySelector('.auth-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--bg-color);
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 320px;
      width: 90%;
    `;

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Enter Secret Key';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--text-color);
    `;

    // Create input
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Secret key';
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      background: var(--bg-color);
      color: var(--text-color);
      box-sizing: border-box;
    `;

    // Create attempts info
    const attemptsInfo = document.createElement('div');
    attemptsInfo.className = 'auth-attempts';
    const remainingAttempts = getRemainingAttempts();
    attemptsInfo.textContent = `Remaining attempts: ${remainingAttempts}`;
    attemptsInfo.style.cssText = `
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
    `;

    // Create error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'auth-error';
    errorMessage.style.cssText = `
      color: #ef4444;
      font-size: 12px;
      margin-bottom: 12px;
      display: none;
    `;

    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'auth-loading';
    loadingIndicator.textContent = 'Verifying...';
    loadingIndicator.style.cssText = `
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
      display: none;
    `;

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `;

    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Create submit button
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid var(--primary-color);
      background: var(--primary-color);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Handle submit
    const handleSubmit = async () => {
      const providedKey = input.value.trim();
      
      if (!providedKey) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Please enter a key';
        return;
      }

      // Show loading
      loadingIndicator.style.display = 'block';
      errorMessage.style.display = 'none';
      submitButton.disabled = true;
      submitButton.style.opacity = '0.5';

      try {
        const isValid = await verifyKey(providedKey);
        
        if (isValid) {
          // Authentication successful
          clearFailedAttempts();
          setAuthenticated(true);
          this.isOwner = true; // Enable owner mode
          modal.remove();
          this.toggleEditMode();
        } else {
          // Record failed attempt
          const isNowLocked = recordFailedAttempt();
          
          if (isNowLocked) {
            modal.remove();
            this.showLockoutMessage(300); // 5 minutes in seconds
          } else {
            // Show error with remaining attempts
            errorMessage.style.display = 'block';
            const remaining = getRemainingAttempts();
            errorMessage.textContent = `Invalid key. ${remaining} attempts remaining.`;
            attemptsInfo.textContent = `Remaining attempts: ${remaining}`;
            input.value = '';
            input.focus();
          }
        }
      } catch (error) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Authentication error. Please try again.';
        console.error('Auth error:', error);
      } finally {
        // Hide loading
        loadingIndicator.style.display = 'none';
        submitButton.disabled = false;
        submitButton.style.opacity = '1';
      }
    };

    // Event listeners
    submitButton.addEventListener('click', handleSubmit);
    cancelButton.addEventListener('click', () => modal.remove());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    });

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Assemble modal
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(submitButton);
    modalContent.appendChild(title);
    modalContent.appendChild(input);
    modalContent.appendChild(attemptsInfo);
    modalContent.appendChild(errorMessage);
    modalContent.appendChild(loadingIndicator);
    modalContent.appendChild(buttonsContainer);
    modal.appendChild(modalContent);

    // Add to DOM
    document.body.appendChild(modal);

    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  /**
   * Show lockout message
   */
  showLockoutMessage(seconds) {
    const modal = document.createElement('div');
    modal.className = 'auth-lockout-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--bg-color);
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 320px;
      width: 90%;
      text-align: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Too Many Attempts';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--text-color);
    `;

    const message = document.createElement('p');
    message.textContent = `Please try again in ${seconds} seconds.`;
    message.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 14px;
      color: var(--text-muted);
    `;

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      border: 1px solid var(--primary-color);
      background: var(--primary-color);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    okButton.addEventListener('click', () => modal.remove());

    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(okButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  }

  /**
   * Toggle edit mode on/off
   */
  toggleEditMode() {
    this.editModeEnabled = !this.editModeEnabled;
    
    // Update button style to show active state
    this.editButton.style.background = this.editModeEnabled 
      ? 'var(--accent-bg)' 
      : 'var(--bg-color)';
    this.editButton.style.color = this.editModeEnabled 
      ? 'var(--primary-color)' 
      : 'var(--text-color)';
    
    // Update grid editability
    this.grid.isEditable = this.isOwner && this.editModeEnabled;
    
    // Re-render grid to update cursor states
    this.grid.renderGrid();
    
    // Show/hide edit indicator
    this.updateEditIndicator();
  }

  /**
   * Update visual edit indicator
   */
  updateEditIndicator() {
    if (this.editIndicator) {
      this.editIndicator.style.display = this.editModeEnabled ? 'block' : 'none';
    }
  }

  /**
   * Handle cell click in edit mode
   */
  async handleCellClick(date) {
    if (!this.editModeEnabled || !this.isOwner) return;
    
    // Toggle contribution (handle both sync and async)
    let updatedContribution;
    if (this.data.db) {
      // RxDB instance (async)
      updatedContribution = await this.data.toggleContribution(date);
    } else {
      // LocalStorage instance (sync)
      updatedContribution = this.data.toggleContribution(date);
    }
    
    // Update the specific cell
    this.grid.updateCell(date);
    
    // Update statistics display
    this.updateStatsDisplay();
    
    // Dispatch update event
    document.dispatchEvent(new CustomEvent('contributionDataUpdated'));
  }

  /**
   * Update statistics display in the top bar
   */
  updateStatsDisplay() {
    const stats = this.data.getStatistics();
    
    const topBar = this.container.querySelector('.contribution-top-bar');
    if (topBar) {
      // Find last updated element by its content pattern
      const statElements = topBar.querySelectorAll('div');
      statElements.forEach(el => {
        if (el.textContent.includes('Last Updated:')) {
          el.innerHTML = `<span style="color: var(--text-light);">Last Updated:</span> ${this.formatDate(stats.lastUpdated)}`;
        }
        if (el.textContent.includes('Total Active Days:')) {
          el.innerHTML = `<span style="color: var(--text-light);">Total Active Days:</span> ${stats.totalActiveDays}`;
        }
      });
    }
  }

  /**
   * Render the complete contribution tracker
   */
  render() {
    this.container.innerHTML = '';
    
    // Create main container with stats on top right
    const mainContainer = document.createElement('div');
    mainContainer.className = 'contribution-main-container';
    mainContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    
    // Create top bar with stats on right
    const topBar = document.createElement('div');
    topBar.className = 'contribution-top-bar';
    topBar.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      font-size: 11px;
      color: var(--text-muted);
    `;
    
    // Add edit button (always visible, authentication controls functionality)
    this.editButton.style.marginBottom = '0';
    this.editButton.style.marginRight = 'auto';
    topBar.appendChild(this.editButton);
    
    // Add stats
    const stats = this.data.getStatistics();
    const lastUpdated = document.createElement('div');
    lastUpdated.innerHTML = `<span style="color: var(--text-light);">Last Updated:</span> ${this.formatDate(stats.lastUpdated)}`;
    
    const totalDays = document.createElement('div');
    totalDays.innerHTML = `<span style="color: var(--text-light);">Total Active Days:</span> ${stats.totalActiveDays}`;
    
    topBar.appendChild(lastUpdated);
    topBar.appendChild(totalDays);
    
    mainContainer.appendChild(topBar);
    
    // Add edit indicator if needed
    if (this.isOwner) {
      const editIndicator = document.createElement('div');
      editIndicator.className = 'edit-indicator';
      editIndicator.textContent = 'Click cells to toggle contributions';
      editIndicator.style.cssText = `
        font-size: 11px;
        color: var(--primary-color);
        font-style: italic;
        display: none;
      `;
      mainContainer.appendChild(editIndicator);
      this.editIndicator = editIndicator;
    }
    
    // Add grid
    mainContainer.appendChild(this.gridContainer);
    
    this.container.appendChild(mainContainer);
    
    // Add custom styles
    this.addStyles();
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Add custom styles for the contribution tracker
   */
  addStyles() {
    if (document.getElementById('contribution-tracker-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'contribution-tracker-styles';
    style.textContent = `
      .contribution-grid-wrapper::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      .contribution-grid-wrapper {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
        scroll-behavior: smooth;
      }
      
      .contribution-grid-wrapper::-webkit-scrollbar-track {
        display: none !important;
      }
      
      .contribution-grid-wrapper::-webkit-scrollbar-thumb {
        display: none !important;
      }
      
      .dark-mode .contribution-cell {
        transition: background-color 0.2s ease;
      }
      
      .edit-toggle-button:hover {
        border-color: var(--primary-color);
      }
      
      @media (max-width: 768px) {
        .contribution-grid-wrapper {
          overflow-x: scroll;
          -webkit-overflow-scrolling: touch;
        }
        
        .contribution-month-grid {
          grid-template-columns: repeat(7, 14px);
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Extend the tracker to include more future dates
   */
  extendTimeline(years) {
    const newEndDate = new Date();
    newEndDate.setFullYear(newEndDate.getFullYear() + years);
    this.grid.extendGrid(newEndDate);
  }

  /**
   * Export data for backup
   */
  exportData() {
    return this.data.exportData();
  }

  /**
   * Import data from backup
   */
  importData(importedData) {
    this.data.importData(importedData);
    this.grid.renderVisibleWeeks();
    this.stats.update();
  }

  /**
   * Destroy the tracker and clean up
   */
  destroy() {
    this.container.innerHTML = '';
    this.cells.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContributionTracker;
}