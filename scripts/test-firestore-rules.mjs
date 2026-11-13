import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PROJECT_ID = 'tamil-kavithai-test-suite';

async function runRulesTestSuite() {
  console.log('\n======================================================');
  console.log('   FIREBASE FIRESTORE SECURITY RULES TEST SUITE');
  console.log('======================================================\n');

  const rulesContent = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');

  // Initialize test environment
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8080
    }
  });

  let passed = 0;
  let failed = 0;

  async function check(name, testFn) {
    try {
      await testFn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error('    Error:', err.message);
      failed++;
    }
  }

  try {
    // ── Setup baseline mock data as admin (bypass rules) ──
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      // Seed poem #1 with multiple existing comments in specific order
      await setDoc(doc(adminDb, 'kavithaigal', '1'), {
        id: 1,
        title: 'உயிரின் உறவே',
        content: 'என் உயிரில் கலந்த நட்பே...',
        category: 'நட்பு',
        author: 'கவிஞன் கமலேஷ்',
        likes: 10,
        comments: [
          {
            id: 1001,
            author: 'கவின்',
            text: 'அருமையான வரிகள்!',
            date: 'நவ 01, 2026',
            role: 'user'
          },
          {
            id: 1002,
            author: 'அன்பு',
            text: 'இதயத்தை தொட்டது.',
            date: 'நவ 02, 2026',
            role: 'user'
          },
          {
            id: 1003,
            author: 'நிலா',
            text: 'வாழ்த்துகள் கவிஞரே!',
            date: 'நவ 03, 2026',
            role: 'user'
          }
        ]
      });

      // Seed poem #2 without likes field (to test missing likes handling)
      await setDoc(doc(adminDb, 'kavithaigal', '2'), {
        id: 2,
        title: 'விடியலின் ராகம்',
        content: 'விடியல் பிறந்தது...',
        category: 'இயற்கை',
        author: 'கவிஞன் கமலேஷ்'
      });

      // Seed category
      await setDoc(doc(adminDb, 'categories', 'natpu'), {
        name: 'நட்பு',
        en: 'Friendship',
        emoji: '🤝'
      });

      // Seed guestbook entry
      await setDoc(doc(adminDb, 'guestbook', 'gb1'), {
        id: 1,
        author: 'அன்பர்',
        text: 'வாழ்த்துகள்!',
        date: 'நவ 01, 2026',
        role: 'user'
      });
    });

    // Unauthenticated context (representing public visitors)
    const unauthedContext = testEnv.unauthenticatedContext();
    const db = unauthedContext.firestore();

    // ── 1. Public Read Access ──
    console.log('[1/7] Testing Public Read Access...');
    await check('Public visitor can read poems in kavithaigal', async () => {
      await assertSucceeds(getDoc(doc(db, 'kavithaigal', '1')));
    });

    await check('Public visitor can read categories', async () => {
      await assertSucceeds(getDoc(doc(db, 'categories', 'natpu')));
    });

    await check('Public visitor can read guestbook entries', async () => {
      await assertSucceeds(getDoc(doc(db, 'guestbook', 'gb1')));
    });

    // ── 2. Unauthorized Creation & Deletion ──
    console.log('\n[2/7] Testing Unauthorized Creation & Deletion...');
    await check('Public visitor CANNOT create a new poem in kavithaigal', async () => {
      await assertFails(setDoc(doc(db, 'kavithaigal', '999'), {
        id: 999,
        title: 'Unauthorized Poem',
        content: 'Should fail',
        category: 'காதல்',
        author: 'Attacker'
      }));
    });

    await check('Public visitor CANNOT delete an existing poem', async () => {
      await assertFails(deleteDoc(doc(db, 'kavithaigal', '1')));
    });

    await check('Public visitor CANNOT modify core metadata (title/content)', async () => {
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        title: 'Hacked Title'
      }));
    });

    // ── 3. Like Updates (Non-Arbitrary & Safe Missing Likes Handling) ──
    console.log('\n[3/7] Testing Like Increments & Tamper Resistance...');
    await check('Public visitor can increment likes by exactly +1 (10 -> 11)', async () => {
      await assertSucceeds(updateDoc(doc(db, 'kavithaigal', '1'), {
        likes: 11
      }));
    });

    await check('Public visitor can decrement likes by exactly -1 (11 -> 10)', async () => {
      await assertSucceeds(updateDoc(doc(db, 'kavithaigal', '1'), {
        likes: 10
      }));
    });

    await check('Missing likes field safely handled: can initialize with likes: 1', async () => {
      await assertSucceeds(updateDoc(doc(db, 'kavithaigal', '2'), {
        likes: 1
      }));
    });

    await check('Arbitrary like jump (+10) is REJECTED', async () => {
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        likes: 20
      }));
    });

    await check('Negative likes value is REJECTED', async () => {
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        likes: -1
      }));
    });

    await check('String likes value is REJECTED', async () => {
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        likes: '100'
      }));
    });

    // ── 4. Comments Append, Order Preservation & Tamper Resistance ──
    console.log('\n[4/7] Testing Comment Appends, Order & Tamper Resistance...');
    const existing3Comments = [
      { id: 1001, author: 'கவின்', text: 'அருமையான வரிகள்!', date: 'நவ 01, 2026', role: 'user' },
      { id: 1002, author: 'அன்பு', text: 'இதயத்தை தொட்டது.', date: 'நவ 02, 2026', role: 'user' },
      { id: 1003, author: 'நிலா', text: 'வாழ்த்துகள் கவிஞரே!', date: 'நவ 03, 2026', role: 'user' }
    ];

    const validNewComment = {
      id: 1004,
      author: 'தமிழ்ச்செல்வன்',
      text: 'மிகவும் அருமையான கவிதை!',
      date: 'நவ 12, 2026',
      role: 'user'
    };

    await check('Valid comment append succeeds preserving ALL existing comments in exact order', async () => {
      await assertSucceeds(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: [...existing3Comments, validNewComment]
      }));
    });

    await check('Reordering middle comments [1, 3, 2, 4] is strictly REJECTED', async () => {
      const swappedMiddle = [existing3Comments[0], existing3Comments[2], existing3Comments[1], validNewComment];
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: swappedMiddle
      }));
    });

    await check('Reordering first/second comments [2, 1, 3, 4] is strictly REJECTED', async () => {
      const swappedFirst = [existing3Comments[1], existing3Comments[0], existing3Comments[2], validNewComment];
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: swappedFirst
      }));
    });

    await check('Appending comment with role: "admin" (admin impersonation) is REJECTED', async () => {
      const spoofedAdminComment = {
        id: 1005,
        author: 'நிர்வாகி கமலேஷ்',
        text: 'நன்றி அன்பர்களே!',
        date: 'நவ 12, 2026',
        role: 'admin' // Attempted admin role spoofing
      };
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: [...existing3Comments, validNewComment, spoofedAdminComment]
      }));
    });

    await check('Appending comment with extraneous unapproved fields (hasOnly check) is REJECTED', async () => {
      const dirtyComment = {
        id: 1006,
        author: 'வாசகர்',
        text: 'நல்ல கவிதை',
        date: 'நவ 12, 2026',
        role: 'user',
        injectedPayload: 'malicious' // Disallowed key
      };
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: [...existing3Comments, validNewComment, dirtyComment]
      }));
    });

    await check('Attempting to delete or alter an existing comment is REJECTED', async () => {
      // Replaces prior comments instead of appending
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: [validNewComment]
      }));
    });

    await check('Immediate duplicate comment submission (same author & text) is REJECTED', async () => {
      // Trying to append the exact same comment twice consecutively
      await assertFails(updateDoc(doc(db, 'kavithaigal', '1'), {
        comments: [...existing3Comments, validNewComment, validNewComment]
      }));
    });

    // ── 5. Category Protection ──
    console.log('\n[5/7] Testing Category Modification Protection...');
    await check('Public visitor CANNOT create a new category', async () => {
      await assertFails(setDoc(doc(db, 'categories', 'hacked_cat'), {
        name: 'Hacked',
        en: 'Hacked',
        emoji: '⚠️'
      }));
    });

    await check('Public visitor CANNOT delete an existing category', async () => {
      await assertFails(deleteDoc(doc(db, 'categories', 'natpu')));
    });

    // ── 6. Guestbook Anti-Abuse ──
    console.log('\n[6/7] Testing Guestbook Anti-Abuse Controls...');
    await check('Public visitor can submit a valid guestbook entry', async () => {
      await assertSucceeds(setDoc(doc(db, 'guestbook', 'gb_new'), {
        id: 2,
        author: 'நிலா',
        text: 'தளம் மிகவும் அருமையாக உள்ளது!',
        date: 'நவ 12, 2026',
        role: 'user'
      }));
    });

    await check('Guestbook entry with role: "admin" is REJECTED', async () => {
      await assertFails(setDoc(doc(db, 'guestbook', 'gb_fake_admin'), {
        id: 3,
        author: 'Fake Admin',
        text: 'Spam',
        date: 'நவ 12, 2026',
        role: 'admin'
      }));
    });

    await check('Guestbook entry with excessive text (>1000 chars) is REJECTED', async () => {
      await assertFails(setDoc(doc(db, 'guestbook', 'gb_long'), {
        id: 4,
        author: 'Spammer',
        text: 'A'.repeat(1001),
        date: 'நவ 12, 2026',
        role: 'user'
      }));
    });

    await check('Guestbook entry CANNOT be edited or deleted once submitted', async () => {
      await assertFails(deleteDoc(doc(db, 'guestbook', 'gb1')));
      await assertFails(updateDoc(doc(db, 'guestbook', 'gb1'), {
        text: 'Edited text'
      }));
    });

    // ── 7. Default Deny Catch-All ──
    console.log('\n[7/7] Testing Catch-All Default Deny...');
    await check('Access to undefined collection (e.g. /users) is REJECTED', async () => {
      await assertFails(getDoc(doc(db, 'users', 'admin')));
      await assertFails(setDoc(doc(db, 'users', 'attacker'), { role: 'admin' }));
    });

    await check('Access to undefined collection (e.g. /secrets) is REJECTED', async () => {
      await assertFails(getDoc(doc(db, 'secrets', 'api_key')));
    });

  } finally {
    await testEnv.cleanup();
  }

  console.log('\n======================================================');
  console.log(`   RULES TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRulesTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
