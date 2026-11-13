/**
 * Test Suite: Firebase Admin SDK Security Hardening & Failure Handling
 * ─────────────────────────────────────────────────────────────────────
 * Verifies:
 * 1. Complete elimination of unauthenticated Firestore REST fallback.
 * 2. Missing FIREBASE_SERVICE_ACCOUNT causes explicit HTTP 500 error.
 * 3. Malformed JSON FIREBASE_SERVICE_ACCOUNT causes explicit HTTP 500 error.
 * 4. Incomplete credentials (missing client_email/private_key) causes explicit HTTP 500 error.
 * 5. Admin SDK initialization failure causes explicit HTTP 500 error.
 * 6. Admin SDK write failure reports error without falling back to REST.
 * 7. All admin CRUD operations (Poem Create, Update, Delete, Category Save)
 *    route exclusively through Admin SDK and fail closed securely.
 * 8. Successful Admin SDK writes succeed via 'admin-sdk' method.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  getFirebaseAdminDb,
  adminSavePoem,
  adminDeletePoem,
  adminSaveCategory,
  _resetAdminDbForTesting,
  _setMockFirestoreForTesting
} from '../api/_lib/firebaseAdmin.js';
import poemsHandler from '../api/admin/poems.js';
import categoriesHandler from '../api/admin/categories.js';
import { createSessionToken, generateCsrfToken } from '../api/_lib/auth.js';

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

// Helper to simulate Vercel serverless req/res
function createMockReqRes({ method = 'POST', body = {}, query = {}, cookies = {}, headers = {} }) {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const req = {
    method,
    body,
    query,
    headers: {
      ...headers,
      cookie: cookieHeader
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
  console.log('  TESTING FIREBASE ADMIN SDK SECURITY HARDENING');
  console.log('======================================================\n');

  // ── TEST 1: Source Code Audit for REST Fallback Removal ──
  console.log('[1/8] Verifying complete elimination of unauthenticated REST fallback in source code...');
  const adminCode = fs.readFileSync(path.join(__dirname, '../api/_lib/firebaseAdmin.js'), 'utf-8');
  assert(!adminCode.includes('firestoreRestCall'), 'firestoreRestCall function completely removed');
  assert(!adminCode.includes('firestore.googleapis.com'), 'Direct firestore.googleapis.com endpoint calls removed');
  assert(!adminCode.includes('rest-fallback'), 'rest-fallback return mechanism removed');

  const adminPoemCode = fs.readFileSync(path.join(__dirname, '../api/admin/poems.js'), 'utf-8');
  assert(!adminPoemCode.includes('firestoreRestCall'), 'poems.js does not reference REST fallback');

  // Configure required test secrets for admin route handler testing
  process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'test-strong-admin-session-secret-key-at-least-32-bytes-length!';
  process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$iyyuqBsWbUVIk2I/P7WOROiGNIORQViZsceTM/54E7tWaO2ZZnT1C';

  // Generate valid admin credentials for route handler testing
  const validAdminToken = createSessionToken('kamalesh', 'admin');
  const validCsrf = generateCsrfToken();
  const validCookies = {
    admin_session: validAdminToken,
    csrf_token: validCsrf
  };
  const validHeaders = {
    'x-csrf-token': validCsrf,
    'content-type': 'application/json'
  };

  // ── TEST 2: Missing FIREBASE_SERVICE_ACCOUNT (Undefined) ──
  console.log('\n[2/8] Testing behavior when FIREBASE_SERVICE_ACCOUNT is missing...');
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  await _resetAdminDbForTesting();

  // Test direct function calls
  let thrownMissing = null;
  try {
    getFirebaseAdminDb();
  } catch (err) {
    thrownMissing = err;
  }
  assert(
    thrownMissing && thrownMissing.message.includes('Server configuration error: FIREBASE_SERVICE_ACCOUNT is required'),
    'getFirebaseAdminDb() throws explicit missing credentials error'
  );

  let poemSaveThrown = null;
  try {
    await adminSavePoem({ id: 101, title: 'சோதனை' });
  } catch (err) {
    poemSaveThrown = err;
  }
  assert(
    poemSaveThrown && poemSaveThrown.message.includes('FIREBASE_SERVICE_ACCOUNT is required'),
    'adminSavePoem() fails without falling back to REST'
  );

  let poemDeleteThrown = null;
  try {
    await adminDeletePoem(101);
  } catch (err) {
    poemDeleteThrown = err;
  }
  assert(
    poemDeleteThrown && poemDeleteThrown.message.includes('FIREBASE_SERVICE_ACCOUNT is required'),
    'adminDeletePoem() fails without falling back to REST'
  );

  let categorySaveThrown = null;
  try {
    await adminSaveCategory({ name: 'புதிய தலைப்பு' });
  } catch (err) {
    categorySaveThrown = err;
  }
  assert(
    categorySaveThrown && categorySaveThrown.message.includes('FIREBASE_SERVICE_ACCOUNT is required'),
    'adminSaveCategory() fails without falling back to REST'
  );

  // Test API route handler behavior on missing credentials (should return HTTP 500 with clear message)
  const { req: reqCreate, res: resCreate } = createMockReqRes({
    method: 'POST',
    body: { title: 'சோதனை கவிதை', content: 'வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqCreate, resCreate);
  assert(resCreate.statusCode === 500, 'POST /api/admin/poems returns HTTP 500 when credentials missing');
  assert(
    resCreate.body?.error?.includes('Server configuration error: FIREBASE_SERVICE_ACCOUNT is required'),
    'POST /api/admin/poems returns explicit server configuration error'
  );

  const { req: reqDelete, res: resDelete } = createMockReqRes({
    method: 'DELETE',
    query: { id: '999' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqDelete, resDelete);
  assert(resDelete.statusCode === 500, 'DELETE /api/admin/poems returns HTTP 500 when credentials missing');

  const { req: reqCat, res: resCat } = createMockReqRes({
    method: 'POST',
    body: { name: 'புதிய தலைப்பு', emoji: '🌟' },
    cookies: validCookies,
    headers: validHeaders
  });
  await categoriesHandler(reqCat, resCat);
  assert(resCat.statusCode === 500, 'POST /api/admin/categories returns HTTP 500 when credentials missing');

  // ── TEST 3: Empty / Whitespace FIREBASE_SERVICE_ACCOUNT ──
  console.log('\n[3/8] Testing behavior when FIREBASE_SERVICE_ACCOUNT is whitespace...');
  process.env.FIREBASE_SERVICE_ACCOUNT = '   ';
  await _resetAdminDbForTesting();

  let thrownEmpty = null;
  try {
    getFirebaseAdminDb();
  } catch (err) {
    thrownEmpty = err;
  }
  assert(
    thrownEmpty && thrownEmpty.message.includes('Server configuration error: FIREBASE_SERVICE_ACCOUNT is required'),
    'Whitespace-only credentials treated as missing and rejected'
  );

  // ── TEST 4: Malformed JSON FIREBASE_SERVICE_ACCOUNT ──
  console.log('\n[4/8] Testing behavior when FIREBASE_SERVICE_ACCOUNT is malformed JSON...');
  process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id": "bad-json", unquoted_key:';
  await _resetAdminDbForTesting();

  let thrownJson = null;
  try {
    getFirebaseAdminDb();
  } catch (err) {
    thrownJson = err;
  }
  assert(
    thrownJson && thrownJson.message.includes('FIREBASE_SERVICE_ACCOUNT contains invalid JSON'),
    'Malformed JSON explicitly detected and reports invalid JSON error'
  );

  const { req: reqBadJson, res: resBadJson } = createMockReqRes({
    method: 'POST',
    body: { title: 'சோதனை கவிதை', content: 'வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqBadJson, resBadJson);
  assert(resBadJson.statusCode === 500, 'POST handler returns HTTP 500 for malformed JSON credentials');
  assert(
    resBadJson.body?.error?.includes('contains invalid JSON'),
    'POST handler reports invalid JSON in error message'
  );

  // ── TEST 5: Missing Required Keys in Service Account Object ──
  console.log('\n[5/8] Testing behavior when FIREBASE_SERVICE_ACCOUNT is missing required fields...');
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: 'tamil-kavithai-f5cd8',
    client_email: 'test@example.com'
    // missing private_key
  });
  await _resetAdminDbForTesting();

  let thrownMissingKeys = null;
  try {
    getFirebaseAdminDb();
  } catch (err) {
    thrownMissingKeys = err;
  }
  assert(
    thrownMissingKeys && thrownMissingKeys.message.includes('missing required credentials'),
    'Missing private_key detected and rejected with explicit error'
  );

  // ── TEST 6: Admin SDK Initialization Failure (Malformed PEM Private Key) ──
  console.log('\n[6/8] Testing behavior when Admin SDK cert/init fails...');
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: 'tamil-kavithai-f5cd8',
    client_email: 'test@tamil-kavithai-f5cd8.iam.gserviceaccount.com',
    private_key: 'NOT_A_VALID_PEM_KEY'
  });
  await _resetAdminDbForTesting();

  let thrownCert = null;
  try {
    getFirebaseAdminDb();
  } catch (err) {
    thrownCert = err;
  }
  assert(
    thrownCert && thrownCert.message.includes('Firebase Admin SDK initialization failed'),
    'Admin SDK initialization failure caught and wrapped explicitly'
  );

  const { req: reqInitFail, res: resInitFail } = createMockReqRes({
    method: 'POST',
    body: { title: 'சோதனை கவிதை', content: 'வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqInitFail, resInitFail);
  assert(resInitFail.statusCode === 500, 'Route handler returns HTTP 500 on initialization failure');
  assert(
    resInitFail.body?.error?.includes('Firebase Admin SDK initialization failed'),
    'Route handler error body indicates Admin SDK initialization failure'
  );

  // ── TEST 7: Admin SDK Write Failure (Doc write rejection without REST fallback) ──
  console.log('\n[7/8] Testing write failure reporting without REST fallback...');
  const mockFailingDb = {
    collection: (colName) => ({
      doc: (docId) => ({
        set: async () => {
          throw new Error('Simulated Firestore write rejection: PERMISSION_DENIED / QUOTA_EXCEEDED');
        },
        delete: async () => {
          throw new Error('Simulated Firestore delete rejection: UNAVAILABLE');
        }
      })
    })
  };

  _setMockFirestoreForTesting(mockFailingDb);

  let saveWriteErr = null;
  try {
    await adminSavePoem({ id: 101, title: 'சோதனை' });
  } catch (err) {
    saveWriteErr = err;
  }
  assert(
    saveWriteErr && saveWriteErr.message.includes('Firebase Admin SDK write failed: Simulated Firestore write rejection'),
    'adminSavePoem throws explicit write failure error without falling back to REST'
  );

  let deleteWriteErr = null;
  try {
    await adminDeletePoem(101);
  } catch (err) {
    deleteWriteErr = err;
  }
  assert(
    deleteWriteErr && deleteWriteErr.message.includes('Firebase Admin SDK delete failed: Simulated Firestore delete rejection'),
    'adminDeletePoem throws explicit delete failure error without falling back to REST'
  );

  let catWriteErr = null;
  try {
    await adminSaveCategory({ name: 'சோதனை தலைப்பு' });
  } catch (err) {
    catWriteErr = err;
  }
  assert(
    catWriteErr && catWriteErr.message.includes('Firebase Admin SDK category write failed: Simulated Firestore write rejection'),
    'adminSaveCategory throws explicit category write failure error without falling back to REST'
  );

  // Verify handlers return HTTP 500 with write failure message
  const { req: reqWriteFail, res: resWriteFail } = createMockReqRes({
    method: 'POST',
    body: { title: 'சோதனை கவிதை', content: 'வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqWriteFail, resWriteFail);
  assert(resWriteFail.statusCode === 500, 'POST /api/admin/poems returns HTTP 500 on Admin SDK write failure');
  assert(
    resWriteFail.body?.error?.includes('Firebase Admin SDK write failed'),
    'Handler returns explicit Firebase Admin SDK write failure'
  );

  // ── TEST 8: Successful Admin CRUD Operations via Admin SDK ──
  console.log('\n[8/8] Testing successful Admin CRUD operations via Admin SDK...');
  const writtenDocs = new Map();
  const mockSuccessDb = {
    collection: (colName) => ({
      doc: (docId) => ({
        set: async (data, options) => {
          writtenDocs.set(`${colName}/${docId}`, data);
          return { writeTime: new Date() };
        },
        delete: async () => {
          writtenDocs.delete(`${colName}/${docId}`);
          return { writeTime: new Date() };
        }
      })
    })
  };

  _setMockFirestoreForTesting(mockSuccessDb);

  // 1. Create poem (POST)
  const { req: reqCrudCreate, res: resCrudCreate } = createMockReqRes({
    method: 'POST',
    body: { title: 'புதிய கவிதை', content: 'அழகிய வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqCrudCreate, resCrudCreate);
  assert(resCrudCreate.statusCode === 200, 'POST /api/admin/poems succeeds with HTTP 200');
  assert(resCrudCreate.body?.method === 'admin-sdk', 'Poem created via method: "admin-sdk"');
  assert(resCrudCreate.body?.success === true, 'Poem create reported success: true');
  const createdId = resCrudCreate.body?.poem?.id;
  assert(writtenDocs.has(`kavithaigal/${createdId}`), 'Poem persisted into kavithaigal collection in Firestore');

  // 2. Update poem (PUT)
  const { req: reqCrudUpdate, res: resCrudUpdate } = createMockReqRes({
    method: 'PUT',
    body: { id: createdId, title: 'திருத்தப்பட்ட கவிதை', content: 'புதிய வரிகள்...', category: 'இயற்கை' },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqCrudUpdate, resCrudUpdate);
  assert(resCrudUpdate.statusCode === 200, 'PUT /api/admin/poems succeeds with HTTP 200');
  assert(resCrudUpdate.body?.method === 'admin-sdk', 'Poem updated via method: "admin-sdk"');
  assert(writtenDocs.get(`kavithaigal/${createdId}`)?.title === 'திருத்தப்பட்ட கவிதை', 'Poem updated in Firestore');

  // 3. Delete poem (DELETE)
  const { req: reqCrudDelete, res: resCrudDelete } = createMockReqRes({
    method: 'DELETE',
    query: { id: String(createdId) },
    cookies: validCookies,
    headers: validHeaders
  });
  await poemsHandler(reqCrudDelete, resCrudDelete);
  assert(resCrudDelete.statusCode === 200, 'DELETE /api/admin/poems succeeds with HTTP 200');
  assert(!writtenDocs.has(`kavithaigal/${createdId}`), 'Poem deleted from Firestore collection');

  // 4. Create category (POST)
  const { req: reqCrudCat, res: resCrudCat } = createMockReqRes({
    method: 'POST',
    body: { name: 'புதுமை', emoji: '✨' },
    cookies: validCookies,
    headers: validHeaders
  });
  await categoriesHandler(reqCrudCat, resCrudCat);
  assert(resCrudCat.statusCode === 200, 'POST /api/admin/categories succeeds with HTTP 200');
  assert(writtenDocs.has('categories/புதுமை'), 'Category saved into categories collection in Firestore');

  // Clean up environment variables
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  await _resetAdminDbForTesting();

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
