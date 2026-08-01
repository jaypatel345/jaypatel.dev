// ============================================
// CONTRIBUTION GRID COMPONENT (LeetCode Style)
// ============================================

/**
 * Month-based contribution grid similar to LeetCode's submission table
 * Each month is a separate grid with ~30 cells, arranged in rows
 * Month labels appear below each month's grid
 */

class ContributionGrid {
  constructor(options) {
    this.data = options.data;
    this.isEditable = options.isEditable || false;
    this.onCellClick = options.onCellClick || null;
    this.container = options.container;
    
    // Grid configuration (LeetCode style)
    this.cellSize = 12;
    this.cellMargin = 2;
    this.monthGap = 20;
    this.rowGap = 16;
    this.rowsPerMonth = 7; // 7 rows per month (like days of week)
    
    // Date range - show from Oct 2025 to 2028
    this.startDate = new Date();
    this.startDate.setFullYear(2025); // Start from 2025
    this.startDate.setMonth(9); // October (month 9, 0-indexed)
    this.startDate.setDate(1);
    
    this.endDate = new Date();
    this.endDate.setFullYear(2028); // Show until end of 2028
    this.endDate.setMonth(11);
    this.endDate.setDate(31);
    
    // Grid state
    this.cells = new Map();
    
    this.init();
  }

  /**
   * Initialize the grid
   */
  init() {
    this.renderGrid();
    this.attachThemeListener();
  }

  /**
   * Render the main grid structure
   */
  renderGrid() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create grid wrapper for horizontal scrolling
    this.gridWrapper = document.createElement('div');
    this.gridWrapper.className = 'contribution-grid-wrapper';
    this.gridWrapper.style.cssText = `
      display: flex;
      flex-direction: row;
      gap: ${this.monthGap}px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 10px 0;
      align-items: stretch;
    `;
    
    // Get all months in date range
    const months = this.getMonthsInRange();
    
    // Calculate consistent height for all months based on 7 rows
    const gridHeight = this.rowsPerMonth * (this.cellSize + this.cellMargin);
    const totalHeight = gridHeight + 30; // grid height + label height + gap
    
    // Render each month horizontally
    months.forEach(monthData => {
      const monthContainer = this.renderMonth(monthData, totalHeight);
      this.gridWrapper.appendChild(monthContainer);
    });
    
    this.container.appendChild(this.gridWrapper);
    
    // Scroll to current month on the left side (use requestAnimationFrame for timing)
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.scrollToCurrentMonth(months);
      }, 100);
    });
  }

  /**
   * Get all months in the date range
   */
  getMonthsInRange() {
    const months = [];
    let currentDate = new Date(this.startDate);
    currentDate.setDate(1);
    
    while (currentDate <= this.endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthName = `${currentDate.toLocaleDateString('en-US', { month: 'short' })} ${currentDate.getFullYear()}`;
      
      // Get days in this month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      months.push({
        year,
        month,
        monthName,
        daysInMonth,
        startDate: new Date(year, month, 1)
      });
      
      // Move to next month
      currentDate.setMonth(month + 1);
    }
    
    return months;
  }

  /**
   * Render a single month grid
   */
  renderMonth(monthData, totalHeight) {
    const monthContainer = document.createElement('div');
    monthContainer.className = 'contribution-month-container';
    
    monthContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
      height: ${totalHeight}px;
      justify-content: space-between;
    `;
    
    // Get the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = monthData.startDate.getDay();
    
    // Calculate total cells needed (including offset for first day)
    const totalCells = firstDayOfWeek + monthData.daysInMonth;
    const columnsNeeded = Math.ceil(totalCells / this.rowsPerMonth);
    
    // Create grid for this month
    const grid = document.createElement('div');
    grid.className = 'contribution-month-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${columnsNeeded}, ${this.cellSize + this.cellMargin}px);
      grid-template-rows: repeat(${this.rowsPerMonth}, ${this.cellSize + this.cellMargin}px);
      gap: ${this.cellMargin}px;
      flex-grow: 0;
      grid-auto-flow: column;
    `;
    
    // Add empty cells for days before the month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.cssText = `
        width: ${this.cellSize}px;
        height: ${this.cellSize}px;
        background: transparent;
      `;
      grid.appendChild(emptyCell);
    }
    
    // Render cells for each day in the month
    for (let day = 1; day <= monthData.daysInMonth; day++) {
      const currentDate = new Date(monthData.year, monthData.month, day);
      const contribution = this.data.getContribution(currentDate);
      
      const cell = new ContributionCell({
        date: currentDate,
        contribution: contribution,
        isEditable: this.isEditable,
        onClick: this.onCellClick
      });
      
      grid.appendChild(cell.getElement());
      
      // Store cell reference for updates
      const dateKey = ContributionCell.formatDateKey(currentDate);
      this.cells.set(dateKey, cell);
    }
    
    monthContainer.appendChild(grid);
    
    // Add month label below the grid
    const monthLabel = document.createElement('div');
    monthLabel.className = 'contribution-month-label';
    monthLabel.textContent = monthData.monthName;
    monthLabel.style.cssText = `
      font-size: 11px;
      color: var(--text-light);
      text-align: center;
      font-weight: 500;
    `;
    
    monthContainer.appendChild(monthLabel);
    
    return monthContainer;
  }

  /**
   * Attach theme listener for color updates
   */
  attachThemeListener() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          this.updateColors();
        }
      });
    });
    
    observer.observe(document.body, { attributes: true });
  }

  /**
   * Update all cell colors when theme changes
   */
  updateColors() {
    this.cells.forEach((cell) => {
      cell.update(cell.contribution);
    });
  }

  /**
   * Update a specific cell after data change
   */
  updateCell(date) {
    const dateKey = ContributionCell.formatDateKey(date);
    const cell = this.cells.get(dateKey);
    
    if (cell) {
      const contribution = this.data.getContribution(date);
      cell.update(contribution);
    }
  }

  /**
   * Extend grid to include more future dates
   */
  extendGrid(newEndDate) {
    this.endDate = newEndDate;
    this.data.extendData(newEndDate);
    this.renderGrid();
  }

  /**
   * Get the grid element
   */
  getElement() {
    return this.gridWrapper;
  }

  /**
   * Scroll to current month and position it on the left side
   */
  scrollToCurrentMonth(months) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Find the index of current month
    const currentIndex = months.findIndex(month => 
      month.month === currentMonth && month.year === currentYear
    );
    
    if (currentIndex !== -1) {
      // Get the month container element
      const monthContainers = this.gridWrapper.querySelectorAll('.contribution-month-container');
      const currentMonthContainer = monthContainers[currentIndex];
      
      if (currentMonthContainer) {
        // Calculate position to show current month on the left side with some padding
        const scrollPosition = currentMonthContainer.offsetLeft - 20;
        
        // Use direct scroll assignment for reliability
        this.gridWrapper.scrollLeft = Math.max(0, scrollPosition);
        
        console.log('Scrolling to:', currentMonth, currentYear, 'at position:', scrollPosition);
      } else {
        console.log('Current month container not found');
      }
    } else {
      console.log('Current month not found in months array');
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContributionGrid;
}