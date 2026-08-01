// ============================================
// ACCORDION FUNCTIONALITY
// ============================================

function initAccordions() {
  const toggles = document.querySelectorAll('.work-toggle');
  
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      
      // Close all other accordions
      toggles.forEach(otherToggle => {
        if (otherToggle !== toggle) {
          otherToggle.setAttribute('aria-expanded', 'false');
        }
      });
      
      // Toggle current accordion
      toggle.setAttribute('aria-expanded', !isExpanded);
    });
  });
}

// ============================================
// DARK MODE FUNCTIONALITY
// ============================================

function initDarkMode() {
  const themeToggle = document.querySelector('.theme-toggle');
  const body = document.body;
  
  // Check for saved preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    body.classList.add('dark-mode');
  }
  
  // Toggle dark mode
  themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    
    // Save preference
    if (body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });
}

// ============================================
// WAVING HAND ANIMATION
// ============================================

function initWavingHand() {
  const wavingHand = document.querySelector('.waving-hand');
  
  if (wavingHand) {
    wavingHand.addEventListener('click', () => {
      // Reset animation
      wavingHand.style.animation = 'none';
      wavingHand.offsetHeight; // Trigger reflow
      wavingHand.style.animation = 'wave 1.5s ease-in-out';
    });
  }
}

// ============================================
// CONTRIBUTION TRACKER INITIALIZATION
// ============================================

function initContributionTracker() {
  const trackerContainer = document.getElementById('contribution-tracker');
  
  if (trackerContainer) {
    // Check if all required classes are loaded
    if (typeof ContributionData === 'undefined') {
      console.error('ContributionData class not loaded');
      return;
    }
    if (typeof ContributionCell === 'undefined') {
      console.error('ContributionCell class not loaded');
      return;
    }
    if (typeof ContributionGrid === 'undefined') {
      console.error('ContributionGrid class not loaded');
      return;
    }
    if (typeof ContributionTracker === 'undefined') {
      console.error('ContributionTracker class not loaded');
      return;
    }
    
    // Set isOwner to false - authentication will be handled via secret key
    const isOwner = false; // Edit mode requires authentication
    
    try {
      const tracker = new ContributionTracker({
        container: trackerContainer,
        isOwner: isOwner
      });
      
      // Make tracker globally accessible for debugging/extensions
      window.contributionTracker = tracker;
      
      console.log('Contribution tracker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize contribution tracker:', error);
      console.error('Error details:', error.message, error.stack);
    }
  }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initDarkMode();
  initWavingHand();
  initContributionTracker();
});
