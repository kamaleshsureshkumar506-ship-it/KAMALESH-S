import { requireAdminAuth, requireCsrfCheck } from '../_lib/auth.js';
import { validatePoemInput } from '../_lib/validation.js';
import { adminSavePoem, adminDeletePoem } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  // 1. Independent Server-Side Authentication & Role Verification
  const auth = requireAdminAuth(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }

  // 2. CSRF Token Protection for all state-changing requests
  const csrf = requireCsrfCheck(req);
  if (!csrf.valid) {
    return res.status(403).json({ error: csrf.error || 'Forbidden: CSRF check failed' });
  }

  const method = req.method ? req.method.toUpperCase() : '';

  try {
    if (method === 'POST' || method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      // 3. Server-side validation and sanitization
      const validation = validatePoemInput(body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const poemToSave = validation.sanitized;
      // If POST and no ID provided, compute an ID
      if (method === 'POST' && !poemToSave.id) {
        poemToSave.id = Date.now();
      }

      // 4. Save to Firestore via Firebase Admin SDK
      const result = await adminSavePoem(poemToSave);
      return res.status(200).json({
        success: true,
        message: method === 'POST' ? 'Poem created successfully' : 'Poem updated successfully',
        poem: poemToSave,
        method: result.method
      });
    }

    if (method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const idRaw = req.query?.id || body?.id;
      const poemId = Number(idRaw);

      if (!Number.isFinite(poemId) || poemId <= 0) {
        return res.status(400).json({ error: 'Valid poem ID is required for deletion' });
      }

      await adminDeletePoem(poemId);
      return res.status(200).json({
        success: true,
        message: `Poem ${poemId} deleted successfully`
      });
    }

    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Admin poems handler error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process poem operation' });
  }
}

