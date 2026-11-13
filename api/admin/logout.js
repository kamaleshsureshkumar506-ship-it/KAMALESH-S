import { serializeCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clearSession = serializeCookie('admin_session', '', {
    maxAge: 0,
    httpOnly: true,
    sameSite: 'Strict'
  });

  const clearCsrf = serializeCookie('csrf_token', '', {
    maxAge: 0,
    httpOnly: false,
    sameSite: 'Strict'
  });

  res.setHeader('Set-Cookie', [clearSession, clearCsrf]);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

