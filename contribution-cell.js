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
   * Study time colors (light mode)
   * Level 0: empty, Level 1: light green (2+ hrs), Level 2: mid green (6+ hrs), Level 3: dark green (10+ hrs)
   * Level 4: coding (light green for coding boxes)
   */
  static getColors() {
    return {
      empty: '#ebedf0',
     level1: '#9be9a8',  // light green (GitHub level 1)
      level2: '#40c463',  // mid green (GitHub level 2)
      level3: '#30a14e',   // dark green (GitHub level 3)
         // light green for coding boxes
    };
  }

  /**
   * Study time colors (dark mode)
   */
  static getDarkColors() {
    return {
      empty: '#161b22',
      level1: '#0e4429',  // light green (2+ hours)
      level2: '#006d32',  // mid green (6+ hours)
      level3: '#26a641',  // dark green (10+ hours)
       // light green for coding boxes in dark mode
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
      case 4: return colors.coding;  // coding boxes light green
      default: return colors.empty;
    }
  }

  /**
   * Format date for tooltip
   */
  getTooltipText() {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = this.date.toLocaleDateString('en-US', options);
    
    // Show exact hours if available, otherwise show level description
    if (this.contribution.hours !== null && this.contribution.hours !== undefined) {
      return `${this.contribution.hours}h on ${dateStr}`;
    }
    
    const levelTexts = {
      0: 'No study',
      1: '2h+',
      2: '6h+', 
      3: '10h+'

    };
    
    return `${levelTexts[this.contribution.level] || 'No study'} on ${dateStr}`;
  }

  /**
   * Get (creating if needed) the single shared tooltip element used by all cells
   */
  static getTooltipElement() {
    let tooltip = document.getElementById('contribution-cell-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'contribution-cell-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 10000;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-family: inherit;
        white-space: nowrap;
        background: #1f2328;
        color: #fff;
        pointer-events: none;
        opacity: 0;
        transform: translate(-50%, -100%);
        transition: opacity 0.1s ease;
      `;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  /**
   * Show the shared tooltip positioned above the given cell element
   */
  showTooltip(cell) {
    const tooltip = ContributionCell.getTooltipElement();
    tooltip.textContent = this.getTooltipText();

    const rect = cell.getBoundingClientRect();
    const showBelow = rect.top < 32;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = showBelow ? `${rect.bottom + 8}px` : `${rect.top - 6}px`;
    tooltip.style.transform = showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    tooltip.style.opacity = '1';
  }

  /**
   * Hide the shared tooltip
   */
  static hideTooltip() {
    const tooltip = document.getElementById('contribution-cell-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
  }

  /**
   * Get (creating if needed) the single shared hour-input popup used by all cells
   */
  static getHourInputElement() {
    let input = document.getElementById('contribution-cell-hour-input');
    if (!input) {
      // One-time stylesheet: strips the native number spinner (only
      // reachable via CSS, not inline styles) and adds a focus glow.
      const style = document.createElement('style');
      style.textContent = `
        #contribution-cell-hour-input::-webkit-outer-spin-button,
        #contribution-cell-hour-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        #contribution-cell-hour-input {
          -moz-appearance: textfield;
        }
        #contribution-cell-hour-input:focus {
          outline: none;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18), 0 0 0 3px color-mix(in srgb, var(--primary-color) 25%, transparent);
        }
      `;
      document.head.appendChild(style);

      input = document.createElement('input');
      input.id = 'contribution-cell-hour-input';
      input.type = 'number';
      input.min = '0';
      input.step = '0.5';
      input.placeholder = 'hrs';
      input.style.cssText = `
        position: fixed;
        z-index: 10001;
        width: 84px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 2px solid var(--primary-color);
        background: var(--bg-color);
        color: var(--text-color);
        font-size: 18px;
        font-weight: 600;
        font-family: inherit;
        text-align: center;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        transition: box-shadow 0.15s ease;
        display: none;
      `;
      document.body.appendChild(input);
    }
    return input;
  }

  /**
   * Open the shared hour-input popup above the cell so the owner can type
   * an exact hour count; commits on Enter/blur, cancels on Escape.
   */
  showHourInput(cell) {
    const input = ContributionCell.getHourInputElement();
    const rect = cell.getBoundingClientRect();
    const showBelow = rect.top < 40;

    input.value = this.contribution.hours ?? '';
    input.style.left = `${rect.left + rect.width / 2 - 42}px`;
    input.style.top = showBelow ? `${rect.bottom + 8}px` : `${rect.top - 54}px`;
    input.style.display = 'block';

    ContributionCell.hideTooltip();

    const commit = () => {
      input.style.display = 'none';
      cleanup();
      const hours = parseFloat(input.value);
      if (!isNaN(hours) && hours >= 0) {
        this.onClick(this.date, hours);
      }
    };

    const cancel = () => {
      input.style.display = 'none';
      cleanup();
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') cancel();
    };

    const cleanup = () => {
      input.removeEventListener('blur', commit);
      input.removeEventListener('keydown', onKeydown);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', onKeydown);

    input.focus();
    input.select();
  }

  /**
   * Render the contribution cell
   */
  render() {
    const cell = document.createElement('div');
    cell.className = 'contribution-cell';

    // LeetCode-style sizing and spacing
    cell.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background-color: ${this.getColor()};
      cursor: ${this.isEditable ? 'pointer' : 'default'};
      transition: transform 0.1s ease, background-color 0.2s ease;
    `;

    // Add data attributes for accessibility and debugging
    cell.dataset.date = ContributionCell.formatDateKey(this.date);
    cell.dataset.level = this.contribution.level;

    // Hover effect
    cell.addEventListener('mouseenter', () => {
      if (!this.isEditable) {
        cell.style.transform = 'scale(1.1)';
      }
      this.showTooltip(cell);
    });

    cell.addEventListener('mouseleave', () => {
      cell.style.transform = 'scale(1)';
      ContributionCell.hideTooltip();
    });

    // Click handler for edit mode: opens an inline input for exact hours
    if (this.isEditable && this.onClick) {
      cell.classList.add('editable');
      cell.addEventListener('click', () => {
        this.showHourInput(cell);
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