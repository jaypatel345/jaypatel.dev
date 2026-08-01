// ============================================
// NETLIFY SERVERLESS FUNCTION - AUTH VERIFICATION
// ============================================

/**
 * Secure authentication verification endpoint
 * Secret key is stored in environment variable (never exposed to client)
 * Returns JWT token on successful authentication
 */

const crypto = require('crypto');

// Secret key from environment variable
const SECRET_KEY = process.env.SECRET_KEY || 'jaypatel2026';

// JWT secret for token generation
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';

// Rate limiting (in-memory, for production use Redis)
const rateLimit = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Simple hash function
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate JWT token
 */
function generateToken() {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    sub: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };
  
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');
  
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Main handler function (Netlify format)
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { key } = body;
    
    if (!key) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Key is required' })
      };
    }

    // Rate limiting check
    const clientIp = event.headers['client-ip'] || 
                     event.headers['x-forwarded-for'] || 
                     event.headers['x-real-ip'] || 
                     'unknown';
    const now = Date.now();
    
    if (rateLimit.has(clientIp)) {
      const { attempts, lastAttempt } = rateLimit.get(clientIp);
      
      // Check if locked out
      if (attempts >= MAX_ATTEMPTS && (now - lastAttempt) < LOCKOUT_TIME) {
        const remainingTime = Math.ceil((LOCKOUT_TIME - (now - lastAttempt)) / 1000);
        return {
          statusCode: 429,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            error: 'Too many attempts. Try again later.',
            remainingTime 
          })
        };
      }
      
      // Reset if lockout period passed
      if ((now - lastAttempt) >= LOCKOUT_TIME) {
        rateLimit.delete(clientIp);
      }
    }

    // Verify the key
    const providedHash = hashKey(key);
    const expectedHash = hashKey(SECRET_KEY);
    
    if (providedHash === expectedHash) {
      // Successful authentication
      rateLimit.delete(clientIp); // Clear rate limit on success
      
      const token = generateToken();
      
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: true,
          token: token
        })
      };
    } else {
      // Failed authentication
      const currentData = rateLimit.get(clientIp) || { attempts: 0, lastAttempt: 0 };
      const newAttempts = currentData.attempts + 1;
      
      rateLimit.set(clientIp, {
        attempts: newAttempts,
        lastAttempt: now
      });
      
      const remainingAttempts = MAX_ATTEMPTS - newAttempts;
      
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Invalid key',
          remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
        })
      };
    }
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};