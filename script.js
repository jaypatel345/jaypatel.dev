// ============================================
// TOOLTIPS FOR ICON IMAGES
// (<img> can't render ::after, so wrap them)
// ============================================

function initIconTooltips() {
  document.querySelectorAll('img[data-tip]').forEach(img => {
    const wrap = document.createElement('span');
    wrap.className = 'tip-wrap';
    wrap.setAttribute('data-tip', img.getAttribute('data-tip'));
    img.removeAttribute('data-tip');
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
  });
}

// ============================================
// ROTATING ROLE LINE
// ============================================

let roleTimer = null;

function initRoleRotator() {
  clearInterval(roleTimer);

  const el = document.getElementById('roleText');
  if (!el) return;

  const roles = [
    'AI & Full-Stack Engineer',
    'Product-minded Builder',
    'Detail-oriented Developer',
    'LLM & Agent Tinkerer',
    'Backend & Systems Thinker'
  ];

  // Every phrase is stacked in the same grid cell (so the widest one sets the
  // width and nothing jumps). Letters are individual spans so they can blur
  // in/out one after another, left to right.
  el.setAttribute('aria-label', roles.join(', '));
  el.innerHTML = '';

  const layers = roles.map((role, roleIndex) => {
    const layer = document.createElement('span');
    layer.className = 'role-layer' + (roleIndex === 0 ? ' active' : '');
    layer.setAttribute('aria-hidden', 'true');
    [...role].forEach((char, i) => {
      const letter = document.createElement('span');
      letter.className = 'role-letter';
      letter.style.setProperty('--i', i);
      letter.textContent = char;
      layer.appendChild(letter);
    });
    el.appendChild(layer);
    return layer;
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let index = 0;
  roleTimer = setInterval(() => {
    layers[index].classList.remove('active');
    index = (index + 1) % layers.length;
    layers[index].classList.add('active');
  }, 2800);
}

// ============================================
// CONTACT FORM (opens the visitor's mail client)
// ============================================

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = document.createElement('p');
  status.className = 'form-status muted';
  status.setAttribute('role', 'status');
  form.appendChild(status);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Sending...';
    status.textContent = '';

    try {
      const response = await fetch('https://formsubmit.co/ajax/16ba4ed60ad96f8422c8b15084cca60f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
          _replyto: data.get('email'),
          _subject: `Portfolio message from ${data.get('name')}`,
          _template: 'table',
          _captcha: 'false'
        })
      });
      const result = await response.json();
      if (!response.ok || result.success === 'false' || result.success === false) throw new Error(result.message || 'Request failed');
      form.reset();
      status.textContent = "Message sent. Thanks, I'll get back to you soon.";
    } catch (error) {
      console.warn('Contact form failed:', error);
      status.innerHTML = 'Could not send. Please email <a href="mailto:jaypatel210776@gmail.com">jaypatel210776@gmail.com</a> directly.';
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

// ============================================
// DARK MODE FUNCTIONALITY
// ============================================

function initDarkMode() {
  const themeToggle = document.querySelector('.theme-toggle');
  const body = document.body;
  let activeTransition = null;

  const syncLabel = () => {
    themeToggle.setAttribute('aria-label', body.classList.contains('dark-mode') ? 'Switch to light mode' : 'Switch to dark mode');
  };

  // Check for saved preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    body.classList.add('dark-mode');
  }
  syncLabel();

  // Toggle dark mode
  themeToggle.addEventListener('click', () => {
    // Ignore clicks while a transition is already playing — starting a
    // new one mid-flight throws an InvalidStateError.
    if (activeTransition) return;

    const applyTheme = () => {
      body.classList.toggle('dark-mode');
      syncLabel();

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
  const placeholder = document.getElementById('contribution-tracker');

  // Coming back to Home: put the tracker we already built back in place
  // (no second Firebase connection, no reload flash).
  if (placeholder && window.__trackerNode) {
    placeholder.replaceWith(window.__trackerNode);
    return;
  }

  const trackerContainer = placeholder;
  
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
// QUOTES (slow letter-by-letter blur, like the role line)
// ============================================

const QUOTES = [
  { text: 'Stay hungry. Stay foolish.', author: 'Steve Jobs' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'When something is important enough, you do it even if the odds are not in your favor.', author: 'Elon Musk' },
  { text: 'Failure is an option here. If things are not failing, you are not innovating enough.', author: 'Elon Musk' },
  { text: 'Your most unhappy customers are your greatest source of learning.', author: 'Bill Gates' },
  { text: 'Success is a lousy teacher. It seduces smart people into thinking they can\'t lose.', author: 'Bill Gates' },
  { text: 'Price is what you pay. Value is what you get.', author: 'Warren Buffett' },
  { text: 'It takes 20 years to build a reputation and five minutes to ruin it.', author: 'Warren Buffett' },
  { text: 'Discipline is doing it even when you don\'t feel like it.', author: 'Chris Bumstead' }
];

let quoteTimer = null;

// Words are kept intact (nowrap) so lines never break in the middle of a word
function buildQuoteLetters(text, startIndex) {
  const fragment = document.createDocumentFragment();
  let index = startIndex;

  text.split(' ').forEach((word, wordIndex, words) => {
    const wordEl = document.createElement('span');
    wordEl.className = 'q-word';
    [...word].forEach(char => {
      const letter = document.createElement('span');
      letter.className = 'q-letter';
      letter.style.setProperty('--i', index++);
      letter.textContent = char;
      wordEl.appendChild(letter);
    });
    fragment.appendChild(wordEl);
    if (wordIndex < words.length - 1) {
      fragment.appendChild(document.createTextNode(' '));
      index++;
    }
  });

  return { fragment, index };
}

function initQuoteRotator() {
  clearInterval(quoteTimer);
  const rotor = document.getElementById('quoteRotor');
  if (!rotor) return;

  rotor.innerHTML = '';

  // Start on a random quote so repeat visitors don't always see the same one
  const order = QUOTES.map((_, i) => i);
  let current = Math.floor(Math.random() * QUOTES.length);

  const layers = QUOTES.map((quote, i) => {
    const layer = document.createElement('div');
    layer.className = 'q-layer' + (i === current ? ' active' : '');
    layer.setAttribute('aria-hidden', i === current ? 'false' : 'true');

    const text = document.createElement('p');
    text.className = 'q-text';
    const built = buildQuoteLetters(quote.text, 0);
    text.appendChild(built.fragment);

    const author = document.createElement('p');
    author.className = 'q-author';
    author.appendChild(buildQuoteLetters('— ' + quote.author, built.index).fragment);

    layer.append(text, author);
    rotor.appendChild(layer);
    return layer;
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  quoteTimer = setInterval(() => {
    layers[current].classList.remove('active');
    layers[current].setAttribute('aria-hidden', 'true');
    current = (current + 1) % order.length;
    layers[current].classList.add('active');
    layers[current].setAttribute('aria-hidden', 'false');
  }, 13000);
}

// ============================================
// VISITOR COUNTER
// Each browser is counted once: the number it received is kept in
// localStorage, so reloads and revisits show the same number instead of
// counting again. The running total lives in Firebase at visitors/count.
// ============================================

const VISITOR_STORAGE_KEY = 'visitorNumber';
let visitorRequest = null;

function ordinalSuffix(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
}

function readStoredVisitorNumber() {
  try {
    const value = parseInt(localStorage.getItem(VISITOR_STORAGE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    return null;
  }
}

function storageWorks() {
  try {
    localStorage.setItem('__probe', '1');
    localStorage.removeItem('__probe');
    return true;
  } catch (error) {
    return false;
  }
}

// Resolves with this visitor's number (new visitors increment the total once)
function getVisitorNumber() {
  const stored = readStoredVisitorNumber();
  if (stored) return Promise.resolve(stored);
  if (visitorRequest) return visitorRequest;

  if (typeof firebase === 'undefined' || !window.firebaseDatabase) {
    return Promise.reject(new Error('Firebase unavailable'));
  }

  const ref = window.firebaseDatabase.ref('visitors/count');

  // If we can't remember the visitor (storage blocked), show the current
  // total without incrementing, so reloads can't inflate it.
  if (!storageWorks()) {
    visitorRequest = ref.once('value').then(snapshot => snapshot.val() || 0);
    return visitorRequest;
  }

  visitorRequest = ref
    .transaction(current => (current || 0) + 1)
    .then(result => {
      if (!result.committed) throw new Error('Visitor count not saved');
      const number = result.snapshot.val();
      try { localStorage.setItem(VISITOR_STORAGE_KEY, String(number)); } catch (error) { /* ignore */ }
      return number;
    })
    .finally(() => { visitorRequest = null; });

  return visitorRequest;
}

function initVisitorCounter() {
  const box = document.getElementById('visitorBox');
  if (!box) return;

  getVisitorNumber()
    .then(number => {
      document.getElementById('visitorCount').textContent = number.toLocaleString('en-US');
      document.getElementById('visitorSuffix').textContent = ordinalSuffix(number);
      box.hidden = false;
    })
    .catch(error => {
      // Leave the counter hidden rather than showing a wrong number
      console.warn('Visitor counter unavailable:', error.message);
    });
}

// ============================================
// SMOOTH SCROLLING
// Inertia scrolling for the whole site. Falls back to the browser's native
// scrolling if the library can't load or the visitor prefers reduced motion.
// ============================================

let lenis = null;

function initSmoothScroll() {
  if (typeof Lenis === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    anchors: false
  });
  window.__lenis = lenis;

  const raf = time => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

// Scroll to a target (element, offset number, or 0) smoothly, or instantly
function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { immediate, offset: typeof target === 'number' ? 0 : -24 });
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' });
  } else {
    target.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
  }
}

// ============================================
// PER-PAGE SETUP (runs on first load and after every page swap)
// ============================================

function initPage() {
  initIconTooltips();
  initContactForm();
  initRoleRotator();
  initQuoteRotator();
  initVisitorCounter();
  initWavingHand();
  initContributionTracker();
}

// ============================================
// CLIENT-SIDE NAVIGATION
// Full page loads would restart the music, so internal links swap only the
// page content. The nav, the side buttons and the <audio> element stay put.
// ============================================

const PAGE_FILES = ['index.html', 'projects.html', 'about.html'];

// "/", "/about" and "/about.html" all map to a page file name
function pageName(pathname) {
  const last = pathname.split('/').pop();
  if (!last) return 'index.html';
  return last.endsWith('.html') ? last : last + '.html';
}

function isPageLink(anchor) {
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, location.href);
  return url.origin === location.origin && PAGE_FILES.includes(pageName(url.pathname));
}

function samePage(url) {
  return pageName(url.pathname) === pageName(location.pathname);
}

async function navigateTo(url, { push = true } = {}) {
  try {
    const response = await fetch(url.pathname + url.search, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');

    const incoming = doc.querySelector('.page');
    const current = document.querySelector('.page');
    if (!incoming || !current) throw new Error('page shell missing');

    // Keep the tracker alive while we are away from Home
    const tracker = document.getElementById('contribution-tracker');
    if (tracker && tracker.children.length) window.__trackerNode = tracker;

    clearInterval(roleTimer);
    clearInterval(quoteTimer);

    current.replaceWith(document.importNode(incoming, true));
    const links = document.querySelector('.nav-links');
    const newLinks = doc.querySelector('.nav-links');
    if (links && newLinks) links.innerHTML = newLinks.innerHTML;
    document.title = doc.title;

    if (push) history.pushState({}, '', url.pathname + url.search + url.hash);

    initPage();

    if (url.hash && document.querySelector(url.hash)) settleOnHash(url.hash);
    else scrollToTarget(0, { immediate: true });
  } catch (error) {
    console.warn('Client-side navigation failed, doing a full load:', error);
    location.href = url.href;
  }
}

function initNavigation() {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!isPageLink(anchor)) return;

    const url = new URL(anchor.href, location.href);

    // Same page: let the browser handle anchors like #contact
    if (samePage(url)) {
      const target = url.hash && document.querySelector(url.hash);
      if (target) {
        event.preventDefault();
        scrollToTarget(target);
        history.replaceState({}, '', url.pathname + url.search + url.hash);
      } else if (!url.hash) {
        event.preventDefault();
        scrollToTarget(0);
      }
      return;
    }

    event.preventDefault();
    navigateTo(url);
  });

  window.addEventListener('popstate', () => {
    navigateTo(new URL(location.href), { push: false });
  });
}

// Land on a #hash target and keep it pinned while content above it
// (images, tracker, fonts) finishes laying out, so we don't stop short.
function settleOnHash(hash) {
  const go = () => {
    const el = document.querySelector(hash);
    if (el) scrollToTarget(el, { immediate: true });
  };
  go();
  const ro = new ResizeObserver(go);
  ro.observe(document.body);
  const stop = () => ro.disconnect();
  ['wheel', 'touchstart', 'keydown'].forEach(e => window.addEventListener(e, stop, { once: true, passive: true }));
  // Lenis refreshes its scroll limit on its own resize pass; re-pin after it
  [150, 500, 1000, 1800].forEach(ms => setTimeout(go, ms));
  setTimeout(stop, 2500);
  window.addEventListener('load', go, { once: true });
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initSmoothScroll();
  initNavigation();
  initPage();
  if (location.hash && document.querySelector(location.hash)) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    settleOnHash(location.hash);
  }
});
