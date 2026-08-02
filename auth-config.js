// ============================================
// AUTHENTICATION CONFIGURATION
// ============================================

/**
 * Hashed secret key for edit mode authentication
 * Pre-computed hash of your secret key
 * Generate with: hashKey('your-secret-key')
 */
const SECRET_HASH = '-1818546715'; // Hash of 'jay2005'

/**
 * Better hash function using SHA-256 (if available) or fallback
 */
async function hashKey(key) {
  if (crypto && crypto.subtle) {
    // Use Web Crypto API for better security
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } else {
    // Fallback to simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

/**
 * Simple hash function for synchronous operations (fallback)
 */
function simpleHash(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Rate limiting configuration
 */
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Check if user is locked out due to too many failed attempts
 */
function isLockedOut() {
  const lockoutUntil = sessionStorage.getItem('authLockoutUntil');
  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil);
    if (Date.now() < lockoutTime) {
      return true;
    } else {
      // Lockout expired, clear it
      sessionStorage.removeItem('authLockoutUntil');
      sessionStorage.removeItem('authAttempts');
    }
  }
  return false;
}

/**
 * Record failed authentication attempt
 */
function recordFailedAttempt() {
  const attempts = parseInt(sessionStorage.getItem('authAttempts') || '0') + 1;
  sessionStorage.setItem('authAttempts', attempts.toString());
  
  if (attempts >= MAX_ATTEMPTS) {
    // Lock out for 5 minutes
    const lockoutUntil = Date.now() + LOCKOUT_TIME;
    sessionStorage.setItem('authLockoutUntil', lockoutUntil.toString());
    return true; // Now locked out
  }
  return false; // Not locked out yet
}

/**
 * Clear failed attempts on successful authentication
 */
function clearFailedAttempts() {
  sessionStorage.removeItem('authAttempts');
  sessionStorage.removeItem('authLockoutUntil');
}

/**
 * Get remaining lockout time in seconds
 */
function getLockoutTimeRemaining() {
  const lockoutUntil = sessionStorage.getItem('authLockoutUntil');
  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil);
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }
  return 0;
}

/**
 * Get remaining attempts
 */
function getRemainingAttempts() {
  if (isLockedOut()) return 0;
  return MAX_ATTEMPTS - parseInt(sessionStorage.getItem('authAttempts') || '0');
}

/**
 * Verify if provided key matches secret key (using server endpoint if available)
 */
async function verifyKey(providedKey) {
  // Check if running on localhost (disable server verification)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    // Try server verification first (more secure)
    try {
      const response = await fetch('/.netlify/functions/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: providedKey })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Store JWT token
          if (data.token) {
            sessionStorage.setItem('authToken', data.token);
          }
          return true;
        }
      }
    } catch (error) {
      console.log('Server verification failed, falling back to client-side');
    }
  }
  
  // Fallback to client-side verification (less secure)
  const providedHash = simpleHash(providedKey);
  return providedHash === SECRET_HASH;
}

/**
 * Set authentication state in session storage
 */
function setAuthenticated(isAuthenticated) {
  sessionStorage.setItem('isAuthenticated', isAuthenticated.toString());
  if (!isAuthenticated) {
    sessionStorage.removeItem('authToken');
  }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const isAuth = sessionStorage.getItem('isAuthenticated') === 'true';
  const hasToken = sessionStorage.getItem('authToken');
  
  // Check both session state and token presence
  return isAuth && hasToken;
}

/**
 * Clear authentication state
 */
function clearAuthentication() {
  sessionStorage.removeItem('isAuthenticated');
  sessionStorage.removeItem('authToken');
  clearFailedAttempts();
}

/**
 * Get authentication token
 */
function getAuthToken() {
  return sessionStorage.getItem('authToken');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SECRET_HASH,
    hashKey,
    simpleHash,
    verifyKey,
    setAuthenticated,
    isAuthenticated,
    clearAuthentication,
    getAuthToken,
    isLockedOut,
    recordFailedAttempt,
    clearFailedAttempts,
    getLockoutTimeRemaining,
    getRemainingAttempts,
    MAX_ATTEMPTS,
    LOCKOUT_TIME
  };
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
  window.LOCKOUT_TIME = LOCKOUT_TIME;
  window.MAX_ATTEMPTS = MAX_ATTEMPTS;
}