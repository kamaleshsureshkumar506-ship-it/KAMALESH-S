import { requireAdminAuth, parseCookies, generateCsrfToken, serializeCookie, SESSION_DURATION_SECONDS } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const auth = requireAdminAuth(req);
    if (!auth.authenticated) {
      return res.status(401).json({
        authenticated: false,
        error: auth.error
      });
    }

    const cookies = parseCookies(req);
    let csrfToken = cookies.csrf_token;
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      const csrfCookie = serializeCookie('csrf_token', csrfToken, {
        maxAge: SESSION_DURATION_SECONDS,
        httpOnly: false,
        sameSite: 'Strict'
      });
      res.setHeader('Set-Cookie', [csrfCookie]);
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        username: auth.user.sub,
        role: auth.user.role,
        expiresAt: auth.user.exp
      },
      csrfToken
    });
  } catch (error) {
    console.error('Auth-check handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

