/**
 * Server-Side Data Validation and Sanitization
 */

export const MAX_LENGTHS = {
  title: 100,
  content: 5000,
  category: 50,
  author: 50,
  url: 2048
};

const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'i.imgur.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com'
];

/**
 * Sanitize untrusted input strings by stripping HTML tags, scripts, and dangerous schemes.
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/(?:javascript|vbscript|data)\s*:/gi, '')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * Validate an image URL for safety.
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: true, url: '' };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) return { valid: true, url: '' };

  // Allow root-relative paths like /kavingnar-kamalesh.jpg
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return { valid: true, url: trimmed };
  }

  // Allow safe base64 data URLs under 800KB
  if (trimmed.startsWith('data:image/')) {
    if (!/^data:image\/(jpeg|jpg|png|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return { valid: false, error: 'Invalid base64 image data' };
    }
    if (trimmed.length > 800 * 1024) {
      return { valid: false, error: 'Image exceeds maximum size (800KB)' };
    }
    return { valid: true, url: trimmed };
  }

  if (trimmed.length > MAX_LENGTHS.url) {
    return { valid: false, error: 'Image URL is too long' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS image URLs are permitted' };
    }
    const hostAllowed = ALLOWED_IMAGE_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );
    if (!hostAllowed) {
      return {
        valid: false,
        error: `Host not allowed. Allowed hosts: ${ALLOWED_IMAGE_HOSTS.join(', ')}`
      };
    }
    return { valid: true, url: trimmed };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate and sanitize a poem object on the server.
 */
export function validatePoemInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const rawTitle = typeof body.title === 'string' ? body.title : '';
  const rawContent = typeof body.content === 'string' ? body.content : '';
  const rawCategory = typeof body.category === 'string' ? body.category : '';
  const rawAuthor = typeof body.author === 'string' ? body.author : 'கவிஞன் கமலேஷ்';

  const title = sanitizeString(rawTitle).slice(0, MAX_LENGTHS.title);
  const content = sanitizeString(rawContent).slice(0, MAX_LENGTHS.content);
  const category = sanitizeString(rawCategory).slice(0, MAX_LENGTHS.category);
  const author = sanitizeString(rawAuthor).slice(0, MAX_LENGTHS.author);

  if (!title) {
    return { valid: false, error: 'Poem title is required' };
  }
  if (!content) {
    return { valid: false, error: 'Poem content is required' };
  }
  if (!category) {
    return { valid: false, error: 'Poem category is required' };
  }

  const imgCheck = validateImageUrl(body.image);
  if (!imgCheck.valid) {
    return { valid: false, error: imgCheck.error };
  }

  const sanitized = {
    title,
    content,
    category,
    author: author || 'கவிஞன் கமலேஷ்',
    image: imgCheck.url || '/kavingnar-kamalesh.jpg',
    featured: Boolean(body.featured),
    likes: typeof body.likes === 'number' && body.likes >= 0 ? body.likes : 0,
    comments: Array.isArray(body.comments) ? body.comments : [],
    youtubeUrl: typeof body.youtubeUrl === 'string' ? body.youtubeUrl.slice(0, 2048) : ''
  };

  if (body.id !== undefined) {
    const numId = Number(body.id);
    if (!Number.isFinite(numId) || numId <= 0) {
      return { valid: false, error: 'Invalid poem ID' };
    }
    sanitized.id = numId;
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize category input on the server.
 */
export function validateCategoryInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const name = sanitizeString(body.name || '').slice(0, MAX_LENGTHS.category);
  const en = sanitizeString(body.en || name).slice(0, MAX_LENGTHS.category);
  const emoji = typeof body.emoji === 'string' && body.emoji.trim() ? body.emoji.trim().slice(0, 10) : '📖';

  if (!name) {
    return { valid: false, error: 'Category name is required' };
  }

  return {
    valid: true,
    sanitized: { name, en, emoji }
  };
}

