import {
  verifyAdminPassword,
  createSessionToken,
  generateCsrfToken,
  serializeCookie,
  validateAuthConfig,
  ADMIN_USERNAME,
  SESSION_DURATION_SECONDS
} from '../_lib/auth.js';
import {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin
} from '../_lib/rateLimit.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = getClientIp(req);

  // 1. Check persistent rate limiting
  const rateLimitStatus = await checkLoginRateLimit(ip);
  if (!rateLimitStatus.allowed) {
    res.setHeader('Retry-After', rateLimitStatus.retryAfterSeconds);
    return res.status(429).json({
      error: rateLimitStatus.error,
      remaining: 0,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  try {
    // 1. Verify both required auth secrets are configured and meet strength requirements
    validateAuthConfig();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { username, password } = body;

    if (!password || typeof password !== 'string') {
      await recordFailedLogin(ip);
      return res.status(400).json({ error: 'Password is required' });
    }

    // Optional username check (if provided, must match ADMIN_USERNAME)
    if (username && typeof username === 'string' && username.trim() !== ADMIN_USERNAME) {
      const record = await recordFailedLogin(ip);
      return res.status(401).json({
        error: 'Invalid credentials',
        remaining: record.remaining,
        retryAfterSeconds: record.retryAfterSeconds
      });
    }

    // 2. Verify password with bcrypt
    const isValid = await verifyAdminPassword(password.trim());
    if (!isValid) {
      const record = await recordFailedLogin(ip);
      const status = record.allowed ? 401 : 429;
      return res.status(status).json({
        error: record.allowed ? 'Invalid credentials' : record.error,
        remaining: record.remaining,
        retryAfterSeconds: record.retryAfterSeconds
      });
    }

    // 3. Clear rate limit counter on success
    await recordSuccessfulLogin(ip);

    // 4. Create cryptographically signed session token and CSRF token
    const effectiveUsername = username && username.trim() ? username.trim() : ADMIN_USERNAME;
    const sessionToken = createSessionToken(effectiveUsername, 'admin');
    const csrfToken = generateCsrfToken();

    // 5. Serialize secure cookies
    const sessionCookie = serializeCookie('admin_session', sessionToken, {
      maxAge: SESSION_DURATION_SECONDS,
      httpOnly: true,
      sameSite: 'Strict'
    });

    const csrfCookie = serializeCookie('csrf_token', csrfToken, {
      maxAge: SESSION_DURATION_SECONDS,
      httpOnly: false, // readable by client to place in X-CSRF-Token header
      sameSite: 'Strict'
    });

    res.setHeader('Set-Cookie', [sessionCookie, csrfCookie]);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: {
        username: effectiveUsername,
        role: 'admin'
      },
      csrfToken
    });
  } catch (error) {
    console.error('Login handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

