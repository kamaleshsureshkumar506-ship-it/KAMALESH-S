/**
 * Security Utilities for Tamil Kavithai
 * ──────────────────────────────────────
 * Client-side security layer: input sanitisation, password hashing,
 * rate-limiting, URL validation, session management, and anti-spam.
 *
 * NOTE: True authentication must live on a server. This module raises
 * the bar significantly for a static-deploy app but is NOT a substitute
 * for server-side controls.
 */

// ── Pre-computed SHA-256 hash of the admin password ──────────────────
// (password is never stored in plaintext in the bundle)
export const ADMIN_PASSWORD_HASH =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

// ── Max input lengths ────────────────────────────────────────────────
export const MAX_INPUT_LENGTHS = {
  name: 50,
  comment: 1000,
  title: 100,
  content: 5000,
  author: 50,
  url: 2048,
  password: 128,
};

// ── Session timeout (30 minutes) ─────────────────────────────────────
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_WARNING_MS = 2 * 60 * 1000; // warn 2 min before expiry

// ── Text sanitisation ───────────────────────────────────────────────
/**
 * Strip dangerous HTML/script content from user-supplied text.
 * React's JSX already escapes interpolated strings, but we sanitise
 * *before* persisting to localStorage so stored data is always clean.
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  let cleaned = text
    // remove <script> … </script> blocks (including multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // remove HTML tags
    .replace(/<\/?[^>]+(>|$)/g, '')
    // remove on* event handlers that may have survived
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    // remove javascript: / data: URI schemes
    .replace(/(?:javascript|data)\s*:/gi, '')
    // collapse excessive whitespace (keep single newlines for poems)
    .replace(/[ \t]{3,}/g, '  ')
    // limit consecutive newlines
    .replace(/\n{4,}/g, '\n\n\n');

  return cleaned.trim();
}

// ── Password hashing (Web Crypto API) ───────────────────────────────
/**
 * Compute SHA-256 hex digest of a string.
 * Uses the native Web Crypto API — no external dependencies.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify a plaintext password against an expected SHA-256 hex hash.
 */
export async function verifyPassword(password, expectedHash) {
  const hash = await hashPassword(password);
  // constant-time comparison (as close as JS allows)
  if (hash.length !== expectedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}

// ── Rate limiting ───────────────────────────────────────────────────
const rateLimitStore = new Map();

/**
 * Returns `true` if the action is allowed, `false` if rate-limited.
 *
 * @param {string}  key          Unique key for the action (e.g. 'login', 'comment-42')
 * @param {number}  maxAttempts  Maximum attempts allowed in the window
 * @param {number}  windowMs     Rolling window duration in milliseconds
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }

  const timestamps = rateLimitStore.get(key);
  // purge expired entries
  const valid = timestamps.filter(t => now - t < windowMs);
  rateLimitStore.set(key, valid);

  if (valid.length >= maxAttempts) {
    const oldestInWindow = valid[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  valid.push(now);
  return { allowed: true, remaining: maxAttempts - valid.length, retryAfterMs: 0 };
}

// ── URL validation ──────────────────────────────────────────────────
const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'i.imgur.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

/**
 * Validate an image URL: must be HTTPS, from an allowed host, or a safe
 * base64 image data URL (from local media upload).
 *
 * @param {string} url
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: true }; // empty = no image, that's fine
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) return { valid: true };

  // Allow root-relative local paths like /kavingnar-kamalesh.jpg
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { valid: true };
  }

  // Allow safe uploaded media data URLs
  if (trimmed.startsWith('data:image/')) {
    if (!/^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return { valid: false, reason: 'செல்லுபடியாகாத படம் (Invalid image data)' };
    }
    if (trimmed.length > 800 * 1024) {
      return { valid: false, reason: 'படத்தின் அளவு மிக அதிகம் (Max 800KB)' };
    }
    return { valid: true };
  }

  if (trimmed.length > MAX_INPUT_LENGTHS.url) {
    return { valid: false, reason: `URL மிக நீளமானது (max ${MAX_INPUT_LENGTHS.url} chars)` };
  }

  // block dangerous schemes
  if (/^(?:javascript|vbscript):/i.test(trimmed)) {
    return { valid: false, reason: 'பாதுகாப்பற்ற URL திட்டம் (Unsafe URL scheme)' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'HTTPS URL மட்டுமே அனுமதிக்கப்படும்' };
    }
    const hostAllowed = ALLOWED_IMAGE_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
    if (!hostAllowed) {
      return {
        valid: false,
        reason: `அனுமதிக்கப்பட்ட டொமைன்கள்: ${ALLOWED_IMAGE_HOSTS.join(', ')}`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'செல்லுபடியாகாத URL வடிவம் (Invalid URL format)' };
  }
}

// ── Data schema validation ──────────────────────────────────────────
/**
 * Validate a kavithai (poem) object has all required fields with
 * correct types. Returns the sanitised object or null if invalid.
 */
export function validateKavithaiSchema(item) {
  if (!item || typeof item !== 'object') return null;

  const { id, title, content, category, author } = item;

  if (typeof id !== 'number' || id < 0) return null;
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  if (typeof content !== 'string' || content.trim().length === 0) return null;
  if (typeof category !== 'string' || category.trim().length === 0) return null;
  if (typeof author !== 'string' || author.trim().length === 0) return null;

  let validatedImage = '';
  if (item.image) {
    const rawImage = String(item.image).trim();
    if (rawImage.startsWith('data:image/')) {
      validatedImage = rawImage.slice(0, 800 * 1024);
    } else {
      validatedImage = sanitizeText(rawImage).slice(0, MAX_INPUT_LENGTHS.url);
    }
  }

  return {
    ...item,
    id,
    title: sanitizeText(title).slice(0, MAX_INPUT_LENGTHS.title),
    content: sanitizeText(content).slice(0, MAX_INPUT_LENGTHS.content),
    category: sanitizeText(category),
    author: sanitizeText(author).slice(0, MAX_INPUT_LENGTHS.author),
    image: validatedImage,
    likes: typeof item.likes === 'number' ? item.likes : 0,
    featured: !!item.featured,
    comments: Array.isArray(item.comments) ? item.comments.map(validateCommentSchema).filter(Boolean) : [],
  };
}

/**
 * Validate a comment object.
 */
export function validateCommentSchema(item) {
  if (!item || typeof item !== 'object') return null;

  const { id, author, text, date } = item;

  if (typeof id !== 'number') return null;
  if (typeof author !== 'string' || author.trim().length === 0) return null;
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  if (typeof date !== 'string') return null;

  return {
    id,
    author: sanitizeText(author).slice(0, MAX_INPUT_LENGTHS.name),
    text: sanitizeText(text).slice(0, MAX_INPUT_LENGTHS.comment),
    date: sanitizeText(date),
    role: item.role === 'admin' ? 'admin' : 'user',
  };
}

// ── Honeypot ────────────────────────────────────────────────────────
/**
 * Check if a honeypot field was filled (bots tend to fill hidden fields).
 * Returns true if the submission looks like a bot.
 */
export function isHoneypotTriggered(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// ── Max stored items ────────────────────────────────────────────────
export const MAX_COMMENTS_PER_POEM = 100;
export const MAX_GLOBAL_COMMENTS = 200;
