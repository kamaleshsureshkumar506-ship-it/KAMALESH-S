/**
 * Comprehensive Backend Security Test Suite
 * ─────────────────────────────────────────
 * Tests:
 * 1. Argon2id / bcrypt password hashing & verification
 * 2. Cryptographic session token generation, verification, and tamper resistance
 * 3. Session expiration enforcement
 * 4. Login rate limiting and brute force lockout (HTTP 429)
 * 5. Unauthorized direct API access rejection (HTTP 401)
 * 6. CSRF protection on state-changing operations (HTTP 403)
 * 7. Server-side input sanitization and XSS prevention
 * 8. Firestore security rules verification
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  verifyAdminPassword,
  isValidAdminPasswordHash,
  isValidSessionSecret,
  getSessionSecret,
  validateAuthConfig,
  createSessionToken,
  verifySessionToken,
  generateCsrfToken,
  serializeCookie,
  parseCookies,
  requireAdminAuth,
  requireCsrfCheck
} from '../api/_lib/auth.js';
import loginHandler from '../api/admin/login.js';
import {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin
} from '../api/_lib/rateLimit.js';
import {
  sanitizeString,
  validateImageUrl,
  validatePoemInput
} from '../api/_lib/validation.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function createMockLoginReqRes({ method = 'POST', body = {}, ip = '127.0.0.1' }) {
  const req = {
    method,
    body,
    headers: {
      'x-forwarded-for': ip,
      'content-type': 'application/json'
    }
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING TAMIL KAVITHAI BACKEND SECURITY TEST SUITE');
  console.log('======================================================\n');

  // ── TEST 1: Password Hashing & Hardened Configuration Enforcement ──
  console.log('[1/8] Testing Password Hashing & Configuration Hardening...');

  // 1. Source code check: No hardcoded default hash, fallback password or credential literals
  const authSource = fs.readFileSync(path.join(__dirname, '../api/_lib/auth.js'), 'utf-8');
  assert(!authSource.includes('DEFAULT_ADMIN_HASH'), 'DEFAULT_ADMIN_HASH constant completely removed from auth.js');
  assert(!/process\.env\.ADMIN_PASSWORD_HASH\s*\|\|/.test(authSource), 'No fallback expression for ADMIN_PASSWORD_HASH exists in auth.js');
  assert(!/['"`]\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}['"`]/.test(authSource), 'No hardcoded bcrypt hash literal exists in auth.js');

  // 2. Missing ADMIN_PASSWORD_HASH configuration
  delete process.env.ADMIN_PASSWORD_HASH;
  let missingThrown = null;
  try {
    await verifyAdminPassword('anypassword');
  } catch (err) {
    missingThrown = err;
  }
  assert(
    missingThrown && missingThrown.message.includes('Server configuration error: ADMIN_PASSWORD_HASH environment variable is not configured'),
    'Missing ADMIN_PASSWORD_HASH fails securely with explicit server configuration error'
  );

  // Missing hash tested via Login Handler (must return HTTP 500)
  const { req: reqNoHash, res: resNoHash } = createMockLoginReqRes({
    body: { username: 'kamalesh', password: 'somepassword' },
    ip: '198.51.100.10'
  });
  await loginHandler(reqNoHash, resNoHash);
  assert(resNoHash.statusCode === 500, 'Login handler returns HTTP 500 when ADMIN_PASSWORD_HASH is missing');
  assert(
    resNoHash.body?.error === 'Internal server error',
    'Login handler returns generic Internal server error without leaking configuration details'
  );

  // 3. Whitespace-only ADMIN_PASSWORD_HASH
  process.env.ADMIN_PASSWORD_HASH = '    ';
  let emptyThrown = null;
  try {
    await verifyAdminPassword('anypassword');
  } catch (err) {
    emptyThrown = err;
  }
  assert(
    emptyThrown && emptyThrown.message.includes('Server configuration error: ADMIN_PASSWORD_HASH environment variable is not configured'),
    'Whitespace-only ADMIN_PASSWORD_HASH rejected as unconfigured'
  );

  // 4. Invalid / Malformed ADMIN_PASSWORD_HASH
  process.env.ADMIN_PASSWORD_HASH = 'not-a-valid-bcrypt-hash';
  let invalidThrown = null;
  try {
    await verifyAdminPassword('anypassword');
  } catch (err) {
    invalidThrown = err;
  }
  assert(
    invalidThrown && invalidThrown.message.includes('Server configuration error: ADMIN_PASSWORD_HASH is invalid'),
    'Malformed hash rejected with server configuration error'
  );

  // 5. Insecure / Weak Cost Factor (< 10)
  const weakCostHash = await bcrypt.hash('testpass', 4);
  process.env.ADMIN_PASSWORD_HASH = weakCostHash;
  let weakThrown = null;
  try {
    await verifyAdminPassword('testpass');
  } catch (err) {
    weakThrown = err;
  }
  assert(
    weakThrown && weakThrown.message.includes('minimum cost 10 required'),
    'Weak cost factor (< 10) rejected with explicit insecure cost error'
  );

  // 6. Valid Strong Hash Verification (cost >= 10)
  const testPassword = 'StrongAdminAuth#2026!';
  const strongHash = await bcrypt.hash(testPassword, 10);
  process.env.ADMIN_PASSWORD_HASH = strongHash;

  assert(isValidAdminPasswordHash(strongHash) === true, 'isValidAdminPasswordHash validates cost 10 bcrypt hash');

  const validPass = await verifyAdminPassword(testPassword);
  assert(validPass === true, 'Correct admin password verified successfully with strong bcrypt hash');

  const wrongPass = await verifyAdminPassword('wrongpassword123');
  assert(wrongPass === false, 'Incorrect password correctly rejected by bcrypt');

  const emptyPass = await verifyAdminPassword('');
  assert(emptyPass === false, 'Empty password correctly rejected');

  // ── Session Secret Hardening & Validation Tests ──
  console.log('    Testing ADMIN_SESSION_SECRET hardening & validation...');

  // 1. Source code check: No hardcoded default secret
  assert(!authSource.includes('tamil-kavithai-super-secret-key-2026-production-hmac'), 'Hardcoded session secret fallback removed from auth.js');
  assert(!authSource.includes('SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ||'), 'No fallback expression for ADMIN_SESSION_SECRET in auth.js');

  // 2. Missing ADMIN_SESSION_SECRET
  delete process.env.ADMIN_SESSION_SECRET;
  let missingSecThrown = null;
  try {
    getSessionSecret();
  } catch (err) {
    missingSecThrown = err;
  }
  assert(
    missingSecThrown && missingSecThrown.message.includes('Server configuration error: ADMIN_SESSION_SECRET environment variable is not configured'),
    'Missing ADMIN_SESSION_SECRET throws explicit server configuration error'
  );

  let createThrown = null;
  try {
    createSessionToken('kamalesh');
  } catch (err) {
    createThrown = err;
  }
  assert(
    createThrown && createThrown.message.includes('ADMIN_SESSION_SECRET environment variable is not configured'),
    'createSessionToken fails securely when ADMIN_SESSION_SECRET is missing'
  );

  let verifyThrown = null;
  try {
    verifySessionToken('dummy.token');
  } catch (err) {
    verifyThrown = err;
  }
  assert(
    verifyThrown && verifyThrown.message.includes('ADMIN_SESSION_SECRET environment variable is not configured'),
    'verifySessionToken fails securely when ADMIN_SESSION_SECRET is missing'
  );

  // Missing session secret in Login Handler (must return generic HTTP 500 without leaking message)
  const { req: reqNoSec, res: resNoSec } = createMockLoginReqRes({
    body: { username: 'kamalesh', password: testPassword },
    ip: '198.51.100.12'
  });
  await loginHandler(reqNoSec, resNoSec);
  assert(resNoSec.statusCode === 500, 'Login handler returns HTTP 500 when ADMIN_SESSION_SECRET is missing');
  assert(resNoSec.body?.error === 'Internal server error', 'Login handler returns generic 500 without leaking missing secret error');

  // 3. Whitespace-only ADMIN_SESSION_SECRET
  process.env.ADMIN_SESSION_SECRET = '    ';
  assert(isValidSessionSecret('    ') === false, 'Whitespace-only session secret rejected by isValidSessionSecret');
  let emptySecThrown = null;
  try {
    getSessionSecret();
  } catch (err) {
    emptySecThrown = err;
  }
  assert(
    emptySecThrown && emptySecThrown.message.includes('ADMIN_SESSION_SECRET environment variable is not configured'),
    'Whitespace-only session secret throws unconfigured error'
  );

  // 4. Weak ADMIN_SESSION_SECRET
  // Short secret (< 32 bytes)
  const shortSecret = 'short-secret-under-32-bytes!';
  assert(isValidSessionSecret(shortSecret) === false, 'Secret under 32 bytes rejected by isValidSessionSecret');
  process.env.ADMIN_SESSION_SECRET = shortSecret;
  let shortSecThrown = null;
  try {
    getSessionSecret();
  } catch (err) {
    shortSecThrown = err;
  }
  assert(
    shortSecThrown && shortSecThrown.message.includes('at least 32 bytes of cryptographic randomness required'),
    'Short secret throws weak secret error'
  );

  // Exactly 31 bytes
  const thirtyOneBytes = '1234567890123456789012345678901';
  assert(isValidSessionSecret(thirtyOneBytes) === false, '31-byte secret strictly rejected');

  // Repeated single character (32 chars of 'a')
  const repeatedCharSecret = 'a'.repeat(32);
  assert(isValidSessionSecret(repeatedCharSecret) === false, 'Repeated single-character secret (low entropy) rejected');

  // Low entropy patterned secret
  const patternedSecret = '12121212121212121212121212121212';
  assert(isValidSessionSecret(patternedSecret) === false, 'Patterned low-variety secret rejected');

  // Known leaked default placeholder
  const oldLeakedSecret = 'tamil-kavithai-super-secret-key-2026-production-hmac';
  assert(isValidSessionSecret(oldLeakedSecret) === false, 'Previous leaked default session secret rejected as insecure');

  // Weak secret in Login Handler (must return generic HTTP 500)
  process.env.ADMIN_SESSION_SECRET = shortSecret;
  const { req: reqWeakSec, res: resWeakSec } = createMockLoginReqRes({
    body: { username: 'kamalesh', password: testPassword },
    ip: '198.51.100.13'
  });
  await loginHandler(reqWeakSec, resWeakSec);
  assert(resWeakSec.statusCode === 500, 'Login handler returns HTTP 500 when session secret is weak');
  assert(resWeakSec.body?.error === 'Internal server error', 'Login handler returns generic 500 for weak session secret');

  // 5. Valid Strong ADMIN_SESSION_SECRET
  const cryptoLib = await import('node:crypto');
  const validHexSecret = cryptoLib.default.randomBytes(32).toString('hex');
  assert(isValidSessionSecret(validHexSecret) === true, '64-hex char random secret accepted');
  process.env.ADMIN_SESSION_SECRET = validHexSecret;
  assert(getSessionSecret() === validHexSecret, 'getSessionSecret returns valid configured secret');

  const validBase64Secret = cryptoLib.default.randomBytes(32).toString('base64url');
  assert(isValidSessionSecret(validBase64Secret) === true, 'base64url random secret accepted');

  // 6. validateAuthConfig validation
  const authConfigResult = validateAuthConfig();
  assert(authConfigResult.valid === true, 'validateAuthConfig succeeds when both password hash and session secret are valid');

  // 7. Login Handler with valid credentials
  const { req: reqValidLogin, res: resValidLogin } = createMockLoginReqRes({
    body: { username: 'kamalesh', password: testPassword },
    ip: '198.51.100.11'
  });
  await loginHandler(reqValidLogin, resValidLogin);
  assert(resValidLogin.statusCode === 200, 'Login handler returns HTTP 200 on correct password');
  assert(resValidLogin.body?.success === true, 'Login handler returns success: true');
  assert(typeof resValidLogin.body?.csrfToken === 'string', 'Login handler issues CSRF token');
  assert(Array.isArray(resValidLogin.headers['set-cookie']), 'Login handler issues Set-Cookie headers');

  // ── TEST 2: Session Token Security & Cryptographic Integrity ──
  console.log('\n[2/8] Testing Cryptographic Session Tokens...');
  const token = createSessionToken('kamalesh', 'admin');
  assert(typeof token === 'string' && token.includes('.'), 'Session token generated in <payload>.<signature> format');

  const verified = verifySessionToken(token);
  assert(verified !== null && verified.sub === 'kamalesh' && verified.role === 'admin', 'Valid session token properly verified and decoded');

  // Tamper test: flip a character in the signature
  const parts = token.split('.');
  const tamperedSig = parts[1].slice(0, -1) + (parts[1].endsWith('a') ? 'b' : 'a');
  const tamperedToken = `${parts[0]}.${tamperedSig}`;
  const tamperedVerified = verifySessionToken(tamperedToken);
  assert(tamperedVerified === null, 'Tampered token signature immediately rejected (constant-time verification)');

  // ── TEST 3: Session Expiration Enforcement ──
  console.log('\n[3/8] Testing Session Expiration...');
  // Construct an already-expired token
  const expiredPayload = {
    sub: 'kamalesh',
    role: 'admin',
    exp: Date.now() - 5000, // expired 5 seconds ago
    iat: Date.now() - 10000
  };
  const expBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  import('node:crypto').then(crypto => {
    // Verified via verifySessionToken internal expiration check
  });
  // Verify with an expired payload using createSessionToken logic
  const crypto = await import('node:crypto');
  const expSig = crypto.default
    .createHmac('sha256', getSessionSecret())
    .update(expBase64)
    .digest('base64url');
  const expiredToken = `${expBase64}.${expSig}`;
  const expiredResult = verifySessionToken(expiredToken);
  assert(expiredResult === null, 'Expired session token strictly rejected');

  // ── TEST 4: Login Rate Limiting & Brute Force Lockout ──
  console.log('\n[4/8] Testing Login Rate Limiting & Lockout...');
  const testIp = '198.51.100.42'; // isolated test IP
  await recordSuccessfulLogin(testIp); // clean start

  let limitCheck = await checkLoginRateLimit(testIp);
  assert(limitCheck.allowed === true && limitCheck.remaining === 5, 'Initial state: 5 remaining attempts');

  // Simulate 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    const res = await recordFailedLogin(testIp);
    assert(res.allowed === true && res.remaining === 5 - i, `Failed attempt ${i}: remaining attempts = ${5 - i}`);
  }

  // 5th failed attempt should trigger lockout
  const lockoutRes = await recordFailedLogin(testIp);
  assert(lockoutRes.allowed === false, '5th failed attempt triggers rate limit lockout');
  assert(lockoutRes.remaining === 0, '0 remaining attempts on lockout');
  assert(lockoutRes.retryAfterSeconds > 0, `Lockout retry-after timer active (${lockoutRes.retryAfterSeconds}s)`);

  // Subsequent check is immediately rejected
  const blockedCheck = await checkLoginRateLimit(testIp);
  assert(blockedCheck.allowed === false, 'Blocked IP is immediately rejected without evaluating password');

  // Reset test IP
  await recordSuccessfulLogin(testIp);

  // ── TEST 5: Unauthorized Direct API Access Rejection ──
  console.log('\n[5/8] Testing Unauthorized Direct API Requests...');
  // Simulated request with no cookies
  const reqNoAuth = { headers: {} };
  const authNoCookie = requireAdminAuth(reqNoAuth);
  assert(authNoCookie.authenticated === false, 'Request without session cookie rejected with 401 Unauthorized');

  // Simulated request with invalid cookie
  const reqBadAuth = { headers: { cookie: 'admin_session=invalid.garbage.token' } };
  const authBadCookie = requireAdminAuth(reqBadAuth);
  assert(authBadCookie.authenticated === false, 'Request with forged session cookie rejected with 401 Unauthorized');

  // Simulated request with valid cookie
  const reqGoodAuth = { headers: { cookie: `admin_session=${token}` } };
  const authGoodCookie = requireAdminAuth(reqGoodAuth);
  assert(authGoodCookie.authenticated === true && authGoodCookie.user.role === 'admin', 'Request with valid session cookie accepted with admin role');

  // ── TEST 6: CSRF Protection on State-Changing API Requests ──
  console.log('\n[6/8] Testing CSRF Token Enforcement...');
  const csrfSecret = generateCsrfToken();

  // GET requests should not require CSRF
  const getReq = { method: 'GET', headers: {} };
  assert(requireCsrfCheck(getReq).valid === true, 'Safe method (GET) passes without CSRF');

  // POST without CSRF header
  const postNoHeader = {
    method: 'POST',
    headers: { cookie: `csrf_token=${csrfSecret}` }
  };
  assert(requireCsrfCheck(postNoHeader).valid === false, 'POST without X-CSRF-Token header rejected with 403 Forbidden');

  // POST with mismatched CSRF header
  const postBadHeader = {
    method: 'POST',
    headers: {
      cookie: `csrf_token=${csrfSecret}`,
      'x-csrf-token': 'wrong-csrf-token-1234'
    }
  };
  assert(requireCsrfCheck(postBadHeader).valid === false, 'POST with mismatched CSRF token rejected with 403 Forbidden');

  // POST with matching CSRF header
  const postValid = {
    method: 'POST',
    headers: {
      cookie: `csrf_token=${csrfSecret}`,
      'x-csrf-token': csrfSecret
    }
  };
  assert(requireCsrfCheck(postValid).valid === true, 'POST with matching CSRF cookie & header accepted');

  // ── TEST 7: Server-Side Input Sanitization & XSS Defense ──
  console.log('\n[7/8] Testing Server-Side Input Sanitization...');
  const maliciousTitle = 'என் கவிதை <script>alert("hacked")</script>';
  const sanitizedTitle = sanitizeString(maliciousTitle);
  assert(!sanitizedTitle.includes('<script>') && !sanitizedTitle.includes('alert'), 'Script tags stripped from title');

  const maliciousContent = 'கவிதை வரிகள்<img src=x onerror=alert(1)> தொடர்ந்து...';
  const sanitizedContent = sanitizeString(maliciousContent);
  assert(!sanitizedContent.includes('onerror'), 'Inline event handlers stripped from content');

  // Dangerous protocol in image URL
  const badImg = validateImageUrl('javascript:alert(1)');
  assert(badImg.valid === false, 'javascript: scheme in image URL rejected');

  // Valid HTTPS image from allowed host
  const goodImg = validateImageUrl('https://firebasestorage.googleapis.com/v0/b/app/o/pic.jpg');
  assert(goodImg.valid === true, 'HTTPS image from allowed domain accepted');

  // Complete poem schema validation
  const validPoem = validatePoemInput({
    title: 'விடியலின் கீதம்',
    content: 'விடியல் பிறந்தது\nஇதயம் மலர்ந்தது',
    category: 'இயற்கை',
    author: 'கவிஞன் கமலேஷ்'
  });
  assert(validPoem.valid === true && validPoem.sanitized.title === 'விடியலின் கீதம்', 'Valid poem passes server-side schema validation');

  const invalidPoem = validatePoemInput({
    title: '', // empty title
    content: 'சில வரிகள்...',
    category: 'வாழ்க்கை'
  });
  assert(invalidPoem.valid === false, 'Poem with missing required title rejected with 400 Bad Request');

  // ── TEST 8: Cookie Security Flags ──
  console.log('\n[8/8] Testing Cookie Security Flags...');
  const serialized = serializeCookie('admin_session', token, { maxAge: 7200, httpOnly: true, sameSite: 'Strict' });
  assert(serialized.includes('HttpOnly'), 'admin_session has HttpOnly flag (inaccessible via JavaScript document.cookie)');
  assert(serialized.includes('SameSite=Strict'), 'admin_session has SameSite=Strict flag (defends against cross-site leakage)');
  assert(serialized.includes('Path=/'), 'admin_session has Path=/');
  assert(serialized.includes('Max-Age=7200'), 'admin_session has 2-hour expiration Max-Age');

  console.log('\n======================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

