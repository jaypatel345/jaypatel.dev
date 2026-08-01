// ============================================
// CONTRIBUTION CELL COMPONENT
// ============================================

/**
 * Individual contribution cell that mimics GitHub's contribution squares
 * Handles rendering, hover states, and click interactions (edit mode only)
 */

class ContributionCell {
  constructor(options) {
    this.date = options.date;
    this.contribution = options.contribution;
    this.isEditable = options.isEditable || false;
    this.onClick = options.onClick || null;
    this.element = this.render();
  }

  /**
   * GitHub contribution colors (light mode)
   */
  static getColors() {
    return {
      empty: '#ebedf0',
      level1: '#9be9a8',
      level2: '#40c463',
      level3: '#30a14e',
      level4: '#216e39'
    };
  }

  /**
   * GitHub contribution colors (dark mode)
   */
  static getDarkColors() {
    return {
      empty: '#161b22',
      level1: '#0e4429',
      level2: '#006d32',
      level3: '#26a641',
      level4: '#39d353'
    };
  }

  /**
   * Format date as YYYY-MM-DD (static utility method)
   */
  static formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get appropriate color based on contribution level and theme
   */
  getColor() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const colors = isDarkMode ? this.constructor.getDarkColors() : this.constructor.getColors();
    
    switch (this.contribution.level) {
      case 0: return colors.empty;
      case 1: return colors.level1;
      case 2: return colors.level2;
      case 3: return colors.level3;
      case 4: return colors.level4;
      default: return colors.empty;
    }
  }

  /**
   * Format date for tooltip
   */
  getTooltipText() {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = this.date.toLocaleDateString('en-US', options);
    
    if (this.contribution.count > 0) {
      return `${this.contribution.count} contribution${this.contribution.count > 1 ? 's' : ''} on ${dateStr}`;
    } else {
      return `No contributions on ${dateStr}`;
    }
  }

  /**
   * Render the contribution cell
   */
  render() {
    const cell = document.createElement('div');
    cell.className = 'contribution-cell';
    
    // LeetCode-style sizing and spacing
    cell.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 2px;
      background-color: ${this.getColor()};
      cursor: ${this.isEditable ? 'pointer' : 'default'};
      transition: transform 0.1s ease, background-color 0.2s ease;
    `;

    // Add data attributes for accessibility and debugging
    cell.dataset.date = ContributionCell.formatDateKey(this.date);
    cell.dataset.count = this.contribution.count;
    cell.dataset.level = this.contribution.level;

    // Hover effect
    cell.addEventListener('mouseenter', () => {
      if (!this.isEditable) {
        cell.style.transform = 'scale(1.1)';
      }
    });

    cell.addEventListener('mouseleave', () => {
      cell.style.transform = 'scale(1)';
    });

    // Click handler for edit mode
    if (this.isEditable && this.onClick) {
      cell.classList.add('editable');
      cell.addEventListener('click', () => {
        this.onClick(this.date);
      });
    }

    return cell;
  }

  /**
   * Update the cell with new contribution data
   */
  update(contribution) {
    this.contribution = contribution;
    this.element.style.backgroundColor = this.getColor();
    this.element.dataset.count = contribution.count;
    this.element.dataset.level = contribution.level;
  }

  /**
   * Get the DOM element
   */
  getElement() {
    return this.element;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContributionCell;
}