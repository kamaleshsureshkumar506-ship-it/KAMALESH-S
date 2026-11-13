import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'kamalesh';
export const SESSION_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Validate that a given string is a sufficiently strong session secret:
 * - At least 32 bytes of UTF-8 data.
 * - Not a trivial repeated single-character pattern.
 * - Sufficient variety of characters (at least 8 distinct characters).
 * - Not a known insecure placeholder or default string.
 */
export function isValidSessionSecret(secret) {
  if (!secret || typeof secret !== 'string') return false;
  const trimmed = secret.trim();

  // Minimum length of 32 bytes
  if (Buffer.byteLength(trimmed, 'utf8') < 32) {
    return false;
  }

  // Reject repeated single character (e.g. 'a'.repeat(32))
  if (/^(.)\1+$/.test(trimmed)) {
    return false;
  }

  // Cryptographic randomness requires character variety (at least 8 distinct characters)
  const uniqueChars = new Set(trimmed);
  if (uniqueChars.size < 8) {
    return false;
  }

  // Reject known insecure placeholders or legacy default values
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
    lower.includes('tamil-kavithai-super-secret')
  ) {
    return false;
  }

  return true;
}

/**
 * Retrieve the validated ADMIN_SESSION_SECRET.
 * Strict requirement:
 * - ADMIN_SESSION_SECRET must be configured in environment variables.
 * - Must be at least 32 bytes of cryptographic randomness.
 * - No hardcoded fallback value is permitted.
 * - Fails securely with an explicit server configuration error if missing or invalid.
 */
export function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || !secret.trim()) {
    throw new Error('Server configuration error: ADMIN_SESSION_SECRET environment variable is not configured.');
  }

  if (!isValidSessionSecret(secret)) {
    throw new Error('Server configuration error: ADMIN_SESSION_SECRET is invalid or too weak (at least 32 bytes of cryptographic randomness required).');
  }

  return secret.trim();
}

/**
 * Validate that both critical auth environment variables are configured and meet strength requirements.
 * Throws explicit server configuration errors if either is missing or invalid.
 */
export function validateAuthConfig() {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !hash.trim()) {
    throw new Error('Server configuration error: ADMIN_PASSWORD_HASH environment variable is not configured.');
  }
  if (!isValidAdminPasswordHash(hash)) {
    throw new Error('Server configuration error: ADMIN_PASSWORD_HASH is invalid or uses an insecure cost factor (minimum cost 10 required).');
  }

  const secret = getSessionSecret();
  return { valid: true, secret, hash };
}

/**
 * Validate that a given string is a strong, well-formed bcrypt hash.
 * - Format: $2a$, $2b$, or $2y$ followed by cost factor ($10-$31) and 53 base64 characters.
 * - Total length: exactly 60 characters.
 * - Minimum cost factor: 10 (modern security standard; prevents weak/fast cracking).
 */
export function isValidAdminPasswordHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  const trimmed = hash.trim();
  const match = trimmed.match(/^\$2[aby]\$([0-9]{2})\$[./A-Za-z0-9]{53}$/);
  if (!match) return false;
  const cost = parseInt(match[1], 10);
  return cost >= 10 && cost <= 31;
}

/**
 * Verify a plaintext password against the stored bcrypt hash.
 * Strict security requirements:
 * - ADMIN_PASSWORD_HASH environment variable must be set.
 * - Must be a valid bcrypt hash with a strong cost factor (>= 10).
 * - No default, hardcoded fallback hash is permitted.
 * - Fails securely with an explicit server configuration error if missing or invalid.
 */
export async function verifyAdminPassword(plaintext) {
  const targetHash = process.env.ADMIN_PASSWORD_HASH;

  if (!targetHash || !targetHash.trim()) {
    throw new Error('Server configuration error: ADMIN_PASSWORD_HASH environment variable is not configured.');
  }

  if (!isValidAdminPasswordHash(targetHash)) {
    throw new Error('Server configuration error: ADMIN_PASSWORD_HASH is invalid or uses an insecure cost factor (minimum cost 10 required).');
  }

  if (!plaintext || typeof plaintext !== 'string') {
    return false;
  }

  return bcrypt.compare(plaintext, targetHash.trim());
}

/**
 * Generate a cryptographically signed HMAC token for the session.
 */
export function createSessionToken(username, role = 'admin') {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const payload = {
    sub: username,
    role,
    exp: expiresAt,
    iat: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex')
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode an HMAC session token.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const secret = getSessionSecret();

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null; // Expired
    }
    if (payload.role !== 'admin') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Parse cookies from the HTTP request headers.
 */
export function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers?.cookie || req.headers?.Cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    if (name) {
      list[name] = decodeURIComponent((parts.slice(1).join('=') || '').trim());
    }
  });

  return list;
}

/**
 * Serialize a cookie string with secure defaults.
 */
export function serializeCookie(name, val, options = {}) {
  const enc = encodeURIComponent;
  let str = `${name}=${enc(val)}`;

  const maxAge = options.maxAge !== undefined ? options.maxAge : SESSION_DURATION_SECONDS;
  str += `; Max-Age=${maxAge}`;
  str += `; Path=${options.path || '/'}`;

  if (options.httpOnly !== false) {
    str += '; HttpOnly';
  }

  // Always Secure in production, or if explicitly requested
  if (process.env.NODE_ENV === 'production' || options.secure !== false) {
    str += '; Secure';
  }

  str += `; SameSite=${options.sameSite || 'Strict'}`;
  return str;
}

/**
 * Middleware helper to authenticate an admin request.
 * Checks session cookie + verifies role.
 */
export function requireAdminAuth(req) {
  const cookies = parseCookies(req);
  const sessionToken = cookies.admin_session;

  if (!sessionToken) {
    return { authenticated: false, error: 'Unauthorized: No session token provided' };
  }

  const payload = verifySessionToken(sessionToken);
  if (!payload) {
    return { authenticated: false, error: 'Unauthorized: Invalid or expired session' };
  }

  return { authenticated: true, user: payload };
}

/**
 * Middleware helper to verify CSRF token on state-changing requests (POST, PUT, DELETE).
 */
export function requireCsrfCheck(req) {
  const method = req.method ? req.method.toUpperCase() : 'GET';
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const cookies = parseCookies(req);
  const cookieCsrf = cookies.csrf_token;
  const headerCsrf = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!cookieCsrf || !headerCsrf) {
    return { valid: false, error: 'Forbidden: Missing CSRF token' };
  }

  // Constant-time comparison
  const cBuf = Buffer.from(cookieCsrf);
  const hBuf = Buffer.from(headerCsrf);
  if (cBuf.length !== hBuf.length || !crypto.timingSafeEqual(cBuf, hBuf)) {
    return { valid: false, error: 'Forbidden: Invalid CSRF token mismatch' };
  }

  return { valid: true };
}

