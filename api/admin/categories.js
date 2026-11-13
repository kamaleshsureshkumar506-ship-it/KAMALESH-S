import { requireAdminAuth, requireCsrfCheck } from '../_lib/auth.js';
import { validateCategoryInput } from '../_lib/validation.js';
import { adminSaveCategory } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const auth = requireAdminAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }

  const csrf = requireCsrfCheck(req);
  if (!csrf.valid) {
    return res.status(403).json({ error: csrf.error || 'Forbidden: CSRF check failed' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const validation = validateCategoryInput(body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    await adminSaveCategory(validation.sanitized);
    return res.status(200).json({
      success: true,
      category: validation.sanitized
    });
  } catch (error) {
    console.error('Admin categories handler error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save category' });
  }
}

