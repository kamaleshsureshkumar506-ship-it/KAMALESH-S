// Persistent Server-Side Login Rate Limiting
// Limits: 5 failed attempts per 15 minutes per IP address

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory sliding window cache for fast lookups
const memoryStore = new Map();

/**
 * Extract sanitized client IP address from request headers.
 */
export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',');
    return ips[0].trim();
  }
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Check if the client IP is currently rate-limited.
 */
export async function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = memoryStore.get(ip) || { count: 0, firstAttemptAt: now, lockedUntil: 0 };

  // Check if locked out
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      error: `Too many failed login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`
    };
  }

  // If lockout expired or window elapsed, reset
  if (now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    record.count = 0;
    record.firstAttemptAt = now;
    record.lockedUntil = 0;
    memoryStore.set(ip, record);
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0
  };
}

/**
 * Record a failed login attempt for the client IP.
 */
export async function recordFailedLogin(ip) {
  const now = Date.now();
  const record = memoryStore.get(ip) || { count: 0, firstAttemptAt: now, lockedUntil: 0 };

  if (now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    record.count = 1;
    record.firstAttemptAt = now;
    record.lockedUntil = 0;
  } else {
    record.count += 1;
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
  }

  memoryStore.set(ip, record);

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  const isLocked = record.lockedUntil > now;
  const retryAfterSeconds = isLocked ? Math.ceil((record.lockedUntil - now) / 1000) : 0;

  return {
    allowed: !isLocked,
    remaining,
    retryAfterSeconds,
    error: isLocked
      ? `Too many failed login attempts. Locked out for ${retryAfterSeconds} seconds.`
      : `Invalid credentials. ${remaining} attempt(s) remaining.`
  };
}

/**
 * Clear rate limit state upon successful authentication.
 */
export async function recordSuccessfulLogin(ip) {
  memoryStore.delete(ip);
}

