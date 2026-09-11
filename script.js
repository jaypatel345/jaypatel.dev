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
// SHOW MORE / SHOW LESS (project descriptions)
// ============================================

function initShowMoreButtons() {
  const buttons = document.querySelectorAll('.show-more-btn');

  buttons.forEach(button => {
    const more = button.previousElementSibling;
    const label = button.querySelector('.show-more-label');

    button.addEventListener('click', () => {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      button.setAttribute('aria-expanded', !isExpanded);
      more.classList.toggle('expanded', !isExpanded);
      label.textContent = isExpanded ? 'show more' : 'show less';
    });
  });
}

// ============================================
// DARK MODE FUNCTIONALITY
// ============================================

function initDarkMode() {
  const themeToggle = document.querySelector('.theme-toggle');
  const body = document.body;
  let activeTransition = null;

  // Check for saved preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    body.classList.add('dark-mode');
  }

  // Toggle dark mode
  themeToggle.addEventListener('click', () => {
    // Ignore clicks while a transition is already playing — starting a
    // new one mid-flight throws an InvalidStateError.
    if (activeTransition) return;

    const applyTheme = () => {
      body.classList.toggle('dark-mode');

      // Save preference
      if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
      } else {
        localStorage.setItem('theme', 'light');
      }
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Fall back to an instant switch if the browser can't animate the swap
    if (!document.startViewTransition || prefersReducedMotion) {
      applyTheme();
      return;
    }

    // Expand the new theme outward from the toggle button in a circle
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const root = document.documentElement;
    root.style.setProperty('--theme-toggle-x', `${x}px`);
    root.style.setProperty('--theme-toggle-y', `${y}px`);
    root.style.setProperty('--theme-toggle-r', `${radius}px`);

    activeTransition = document.startViewTransition(applyTheme);
    // Any of these can reject (e.g. the transition gets skipped by the
    // browser); swallow them so they don't surface as unhandled rejections.
    activeTransition.ready.catch(() => {});
    activeTransition.updateCallbackDone.catch(() => {});
    activeTransition.finished
      .catch(() => {})
      .finally(() => { activeTransition = null; });
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
  initShowMoreButtons();
  initDarkMode();
  initWavingHand();
  initContributionTracker();
});
